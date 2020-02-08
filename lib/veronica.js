'use strict';

var libpath    = require('path'),
    Blast      = __Protoblast,
    net        = require('net'),
    Obj        = Blast.Bound.Object,
    fs         = require('fs'),
    Fn         = Blast.Bound.Function;

var cache = {},
    placeholderDefault,
    smartcrop,
    Veronica,
    backup,
    proto,
    child,
    path,
    use,
    fs,
    gm;

// Default options for placeholders
placeholderDefault = {
	width: 100,
	height: 100,
	maxWidth : 8000,
	maxHeight : 8000,
	backgroundStyle : '#CCC',
	textStyle : '#FFF',
	fontFamily : 'Impact',
	fontSizeParam : 5
};

child  = require('child_process');
path   = require('path');
gm = require('gm');

try {
	smartcrop = require('smartcrop');
} catch (err) {
	// Ignore
}

/**
 * The main Veronica class
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.2.0
 */
Veronica = Fn.inherits('Informer', 'Develry.Veronica', function Veronica(options) {

	if (typeof options == 'undefined') {
		options = {};
	}

	// A place to store the temporary files
	if (!options.temp) {
		options.temp = '/tmp';
	}

	// A place to store cache files
	if (!options.cache) {
		options.cache = '/tmp/cache';
	}

	// The location to cwebp
	if (!options.cwebp) {
		options.cwebp = '/usr/bin/cwebp';
	}

	this.cwebp = options.cwebp;
	this.tempPath = options.temp;
	this.cachePath = options.cache;
	this.smartcrop = smartcrop;
});

/**
 * Set the smartcrop image operations
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.2.0
 * @version  0.2.0
 *
 * @type    {Object}
 */
Veronica.setProperty('smartcrop_operations', {
	open : function open(gm) {
		return Blast.Classes.Pledge.resolve({
			width  : gm._width,
			height : gm._height,
			_gm    : gm
		});
	},
	resample : function resample(image, width, height) {
		return Blast.Classes.Pledge.resolve({
			width  : ~~width,
			height : ~~height,
			_gm    : image._gm
		});
	},
	getData : function getData(image) {
		var pledge = new Blast.Classes.Pledge();

		image._gm.resize(image.width, image.height, '!').toBuffer('RGBA', function gotBuffer(err, buffer) {
			if (err) {
				return pledge.reject(err);
			}

			pledge.resolve(new smartcrop.ImgData(image.width, image.height, buffer));
		});

		return pledge;
	}
});

/**
 * Return a new gm instance
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.1
 *
 * @param    {String}   filePath
 */
Veronica.setMethod(function image(filePath) {

	var image = gm(filePath);

	// Create a reference to veronica
	image.veronica = this;

	return image;
});

/**
 * Create a temporary file path
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.2
 *
 * @param    {String}   prefix   The optional prefix to the file
 */
Veronica.setMethod(function getTempFilepath(prefix) {

	var tempFile;

	if (!prefix) {
		prefix = 'veronica-temp-';
	}

	tempFile = prefix + Date.now() + '-' + ~~(Math.random()*10000);

	return path.resolve(this.tempPath, tempFile);
});

/**
 * Get a working path to cwebp
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.2.0
 * @version  0.2.2
 *
 * @param    {Function} callback
 */
Veronica.setCacheMethod(function getCwebpPath(callback) {

	var that = this,
	    paths = Blast.Bound.Array.cast(this.cwebp),
	    tasks = [];

	paths.push('/usr/local/bin/cwebp');
	paths.push('/usr/bin/cwebp');

	paths.forEach(function each(path) {
		tasks.push(function checkPath(next) {

			// See if this path exists
			fs.access(path, fs.constants.F_OK, function onResponse(err) {

				if (err) {
					return next();
				}

				// Found it!
				callback(null, path);
			});
		});
	});

	Fn.series(tasks, function done(err) {

		if (err) {
			return callback(err);
		}

		callback(new Error('Could not find cwebp path'));
	});
});

/**
 * Convert the given file to webp
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.2.2
 *
 * @param    {String}   filePath
 * @param    {Function} callback
 */
Veronica.setMethod(function convertToWebp(filePath, options, callback) {

	var no_explicit_quality,
	    command = '';

	if (typeof options == 'function') {
		callback = options;
		options = {};
	}

	if (!options.quality) {
		no_explicit_quality = true;
		options.quality = 80;
	}

	if (!options.target) {
		options.target = this.getTempFilepath('veronica-webp-');
	}

	// We want to use the best compression method
	command += ' -m 6';

	// Use multithreading if possible
	command += ' -mt';

	// Add the quality command
	if (no_explicit_quality && libpath.extname(filePath).toLowerCase() == '.png') {
		command += ' -near_lossless 40';
	} else {
		command += ' -q ' + options.quality;
	}

	// Add the in file
	command += ' ' + filePath;

	// Add the out file
	command += ' -o ' + options.target;

	this.getCwebpPath(function gotCwebPath(err, cwebp_path) {

		if (err) {
			return callback(err);
		}

		// Execute the cwebp conversion
		child.exec(cwebp_path + command, function done(err, result) {

			if (err) {
				return callback(err);
			}

			callback(null, options.target);
		});
	});
});

/**
 * Resize an image
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.2.2
 *
 * @param    {String}   filePath
 * @param    {Object}   options
 * @param    {Function} callback
 */
Veronica.setMethod(function resize(filePath, options, callback) {

	var that = this,
	    image = this.image(filePath);

	// Auto orient files by default
	if (options.auto_orient !== false) {
		image.autoOrient();
	}

	// Get the current size first
	image.size(function gotSize(err, size) {

		var sc_options,
		    new_height,
		    new_width,
		    ratio;

		if (err) {
			return callback(err);
		}

		// If width & height options are given, crop the image
		if (options.width && options.height) {

			new_width = options.width;
			new_height = options.height;

			if (!options.gravity) {
				options.gravity = 'smartcrop';
			}

			// Resize the image but keep the aspect ratio
			// Only resize if it becomes smaller
			if (new_width < size.width || new_height < size.height) {

				if (new_width > size.width) {
					ratio = size.width / new_width;
					new_width = size.width;
					new_height = ~~(new_height * ratio);
				}

				if (new_height > size.height) {
					ratio = size.height / new_height;
					new_height = size.height;
					new_width = ~~(new_width * ratio);
				}

				if (options.gravity == 'smartcrop' && that.smartcrop) {
					image._width = size.width;
					image._height = size.height;

					sc_options = {
						width  : new_width,
						height : new_height,
						imageOperations: that.smartcrop_operations
					};

					that.smartcrop.crop(image, sc_options, function cropped(result) {

						var crop;

						if (!result) {
							return callback(new Error('Failed to apply smartcrop'));
						}

						crop = result.topCrop;

						// Do the cropping first
						image.crop(crop.width, crop.height, crop.x, crop.y);

						// THEN we can safely resize
						image.resize(new_width, new_height);


						finalizeFile();
					});

					return;
				} else {
					image.resize(new_width, new_height, '^');

					// Set the gravity, from where to originate the crop
					image.gravity(options.gravity);

					// Crop the image
					image.crop(new_width, new_height, 0, 0);
				}
			}

			finalizeFile();

		} else if (options.width || options.height || options.maxWidth || options.maxHeight) {
			new_width = options.width || options.maxWidth;
			new_height = options.height || options.maxHeight;

			if (new_width < size.width || new_height < size.height) {

				if (new_width > size.width) {
					ratio = size.width / new_width;
					new_width = size.width;
					new_height = ~~(new_height * ratio);
				}

				if (new_height > size.height) {
					ratio = size.height / new_height;
					new_height = size.height;
					new_width = ~~(new_width * ratio);
				}

				// If one or the other is given, use them as max settings
				image.resize(new_width, new_height);
			}

			finalizeFile();
		} else {
			finalizeFile();
		}

		// Function that'll do th actual resizing
		function finalizeFile() {
			if (options.type == 'webp') {

				if (options.quality) {
					image.quality(options.quality);
				}

				// Let the webp method handle the file creation
				image.webp(options.target, callback);
			} else {
				// Set the image quality, which defaults to 80
				image.quality(options.quality || 80);

				// Write the file and call the callback
				image.write(options.target, callback);
			}
		}
	});
});

/**
 * See if the given filePath already exists by checking the cache object
 * or looking for the file on disk
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.1
 *
 * @param    {String}   filePath
 * @param    {Function} callback
 */
Veronica.setMethod(function checkCache(filePath, callback) {

	if (cache[filePath]) {
		callback(true);
	} else {
		fs.exists(filePath, function(exists) {
			cache[filePath] = exists;
			callback(exists);
		});
	}
});

/**
 * Get the resized image if it hasn't been resized already
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.2.0
 *
 * @param    {String}   filePath
 * @param    {Object}   options
 * @param    {Function} callback
 */
Veronica.setMethod(function getResizedImage(filePath, options, callback) {

	var that = this,
	    targetPath = options.target,
	    target_name,
	    resize_options = Blast.Bound.JSON.clone(options);

	if (!targetPath) {
		target_name = 'veronica-image-cache-' + Obj.checksum(filePath) + '-';

		if (resize_options.width || resize_options.height) {
			if (resize_options.width) {
				target_name += resize_options.width;
			}

			target_name += 'x';

			if (resize_options.height) {
				target_name += resize_options.height;
			}

			target_name += '-';
		}

		target_name += Obj.checksum(resize_options);

		targetPath = path.resolve(this.cachePath, target_name);
	}

	resize_options.target = targetPath;

	this.checkCache(targetPath, function(exists) {
		if (exists) {
			callback(null, targetPath);
		} else {
			that.resize(filePath, resize_options, function(err) {
				callback(err, targetPath);
			});
		}
	});
});

/**
 * Generate a placeholder image
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.1.0
 * @version  0.2.1
 *
 * @param    {Object}   options
 * @param    {Function} callback   The callback will receive the path of the generated file
 */
Veronica.setMethod(function placeholder(options, callback) {

	var Canvas = require('canvas'),
	    outputfile,
	    filepath,
	    fontSize,
	    hashcode,
	    canvas,
	    height,
	    width,
	    text,
	    key,
	    ctx;

	// See if options have been given
	options = options || {};

	// Generate the hash code
	hashcode = Obj.checksum(options);

	if (cache[hashcode]) {
		return callback(null, cache[hashcode]);
	}

	for (key in placeholderDefault) {
		if (!options[key] && !(key in options)) {
			options[key] = placeholderDefault[key];
		}
	}

	height = options.height;
	width = options.width;

	if (options.text) {
		text = options.text;
	} else {
		text = width + '×' + height;
	}

	if (options.dpr && options.dpr < 20) {
		height *= options.dpr;
		width *= options.dpr;
	}

	canvas = Canvas.createCanvas(width, height);
	ctx = canvas.getContext('2d');

	fontSize = Math.round(Math.min(width/options.fontSizeParam, height));

	ctx.save();
	ctx.fillStyle = options.backgroundStyle;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();

	ctx.save();
	ctx.font = fontSize + 'px ' + options.fontFamily;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = options.textStyle;
	ctx.fillText(text, width / 2, height / 2 - fontSize * 0.1);
	ctx.restore();

	// Generate a cache filepath
	filepath = path.resolve(this.tempPath, 'placeholder-' + hashcode);

	outputfile = fs.createWriteStream(filepath);

	outputfile.on('finish', function onCanvasOutputFinish(err) {

		if (err) {
			callback(err);
		} else {

			// Store the path in the cache
			cache[hashcode] = filepath;

			callback(null, filepath);
		}
	});

	// Pipe the canvas image to the file
	canvas.createPNGStream().pipe(outputfile);
});

/**
 * Store original gm prototype methods in here
 */
backup = {};

/**
 * Output the file as webp
 */
gm.prototype.webp = function webp(target, callback) {

	// Create a temporary filename
	var that = this,
	    tempFile = 'veronica-temp-webp-' + Date.now() + '-' + ~~(Math.random()*10000) + '.png',
	    tempPath = path.resolve(this.veronica.tempPath, tempFile),
	    originalQuality = 80,
	    qindex;

	qindex = this._in.indexOf('-quality');

	if (qindex > -1) {
		// Get the originally set quality
		originalQuality = Number(this._in[qindex+1]) || 80;

		// Remove the quality settings
		this._in.splice(qindex, 2);
	}

	// Set the quality of the gm image to 100%
	this.quality(100);

	// Write out the temporary png file
	this.write(tempPath, function(err) {

		var webpOptions = {};

		if (err) {
			return callback(err);
		}

		// cwebp uses a different quality scale than gm,
		// so we should increment it a bit
		originalQuality += 4;

		if (originalQuality > 100) {
			originalQuality = 100;
		}

		webpOptions.quality = originalQuality;
		webpOptions.target = target;

		that.veronica.convertToWebp(tempPath, webpOptions, function converted(err) {

			// Remove the temporary file
			fs.unlink(tempPath, Fn.thrower);

			callback(err);
		});
	});
};