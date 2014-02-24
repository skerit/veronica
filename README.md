# Veronica

Veronica is a simple wrapper around `gm`,
allowing you to add webp support using cwebp.

## Requirements

You'll need to install these packages on your system:

    sudo apt-get install graphicsmagick webp

## Basic Usage

```js
var Veronica = require('veronica'),
    veronica = new Veronica({temp: '/temp/folder', cache: '/temp/cache'}),
    resizeOptions = {
    	width: 400,
    	height: 400,
    	gravity: 'Center',
    	quality: 80,
    	type: 'webp'
    };

// Resize the image and store it in the cache folder
veronica.getResizedImage('/path/to/original/image', resizeOptions, function(err, resizedPath) {
	// Do something with the path to the resized file
});
```