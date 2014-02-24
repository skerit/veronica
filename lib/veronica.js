var path   = require('path'),
    fs     = require('fs'),
    gm     = require('gm'),
    child  = require('child_process'),
    cache  = {},
    crc32table,
    Veronica,
    backup,
    hasher,
    proto;

/**
 * The main Veronica class
 *
 * @constructor
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.1
 */
Veronica = function Veronica(options) {

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

	this.tempPath = options.temp;
	this.cachePath = options.cache;
};

// Create a reference to Veronica's prototype
proto = Veronica.prototype;

/**
 * Return a new gm instance
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.1
 *
 * @param    {String}   filePath
 */
proto.image = function image(filePath) {

	var image = gm(filePath);

	// Create a reference to veronica
	image.veronica = this;
	
	return image;
};

/**
 * Create a temporary file path
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.1
 *
 * @param    {String}   prefix   The optional prefix to the file
 */
proto.getTempFilepath = function getTempFilepath(prefix) {

	var tempFile;

	if (!prefix) {
		prefix = 'veronica-temp-webp-';
	}

	tempFile = prefix + Date.now() + '-' + ~~(Math.random()*10000);

	return path.resolve(this.tempPath, tempFile);
};

/**
 * Convert the given file to webp
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.1
 *
 * @param    {String}   filePath
 * @param    {Function} callback
 */
proto.convertToWebp = function convertToWebp(filePath, options, callback) {

	var cwebp = '/usr/bin/cwebp',
	    command = '';

	if (typeof options == 'function') {
		callback = options;
		options = {};
	}

	if (!options.quality) {
		options.quality = 80;
	}

	if (!options.target) {
		options.target = this.getTempFilepath();
	}

	// We want to use the best compression method
	command += ' -m 6';

	// Add the quality command
	command += ' -q ' + options.quality;

	// Add the in file
	command += ' ' + filePath;

	// Add the out file
	command += ' -o ' + options.target;

	// Execute the cwebp conversion
	child.exec(cwebp + command, function(err, result) {

		if (err) {
			return callback(err);
		}

		callback(null, options.target);
	});
};

/**
 * Resize an image
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.1
 *
 * @param    {String}   filePath
 * @param    {Object}   options
 * @param    {Function} callback
 */
proto.resize = function resize(filePath, options, callback) {

	var image = this.image(filePath);

	// If width & height options are given, crop the image
	if (options.width && options.height) {

		if (!options.gravity) {
			options.gravity = 'Center';
		}

		// Resize the image but keep the aspect ratio
		image.resize(options.width, options.height, '^');

		// Set the gravity, from where to originate the crop
		image.gravity(options.gravity);

		// Crop the image
		image.crop(options.width, options.height, 0, 0);

	} else if (options.width || options.height || options.maxWidth || options.maxHeight) {
		// If one or the other is given, use them as max settings
		image.resize(options.width || options.maxWidth, options.height || options.maxHeight);
	}

	if (options.type == 'webp') {
		// Let the webp method handle the file creation
		image.webp(options.target, callback);
	} else {
		// Set the image quality, which defaults to 80
		image.quality(options.quality || 80);

		// Write the file and call the callback
		image.write(options.target, callback);
	}
};

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
proto.checkCache = function checkCache(filePath, callback) {

	if (cache[filePath]) {
		callback(true);
	} else {
		fs.exists(filePath, function(exists) {
			cache[filePath] = exists;
			callback(exists);
		});
	}
};

/**
 * Get the resized image if it hasn't been resized already
 *
 * @author   Jelle De Loecker   <jelle@codedor.be>
 * @since    0.0.1
 * @version  0.0.1
 *
 * @param    {String}   filePath
 * @param    {Object}   options
 * @param    {Function} callback
 */
proto.getResizedImage = function getResizedImage(filePath, options, callback) {

	var that = this,
	    targetPath = options.target,
	    resizeOptions = JSON.parse(JSON.stringify(options));

	if (!targetPath) {
		targetPath = path.resolve(this.cachePath, 'veronica-image-cache-' + hasher(filePath) + '-' + hasher(resizeOptions));
	}

	resizeOptions.target = targetPath;

	this.checkCache(targetPath, function(exists) {
		if (exists) {
			callback(null, targetPath);
		} else {
			that.resize(filePath, resizeOptions, function(err) {
				callback(err, targetPath);
			});
		}
	});
};

// Generate the crc32 table
crc32table = (function() {

	var value, pos, i;
	var table = [];

	for (pos = 0; pos < 256; ++pos) {
		value = pos;
		for (i = 0; i < 8; ++i) {
			value = (value & 1) ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
		}
		table[pos] = value >>> 0;
	}

	return table;
})();

/**
 * Generate a very simple, fast hash for a short string
 */
hasher = function hasher(str) {

	var crc, i;

	if (typeof str != 'string') {
		str = JSON.stringify(str);
	}

	crc = 0 ^ (-1);

	for (i = 0; i < str.length; i++ ) {
		crc = (crc >>> 8) ^ crc32table[(crc ^ str.charCodeAt(i)) & 0xFF];
	}

	return (crc ^ (-1)) >>> 0;
};

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
		originalQuality = this._in[qindex+1];

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

		that.veronica.convertToWebp(tempPath, webpOptions, function(err) {

			// Remove the temporary file
			fs.unlink(tempPath, function(){});

			callback(err);
		});
	});
};

module.exports = Veronica;