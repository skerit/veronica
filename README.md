# Veronica

Veronica is a simple wrapper around `gm`,
allowing you to add webp support using cwebp.

## Requirements

You'll need to install these packages on your system:

    sudo apt-get install graphicsmagick webp libgif-dev libcairo2-dev libpixman-1-dev

## Basic Usage

```js
var Veronica = require('veronica'),
    veronica = new Veronica({temp: '/temp/folder', cache: '/temp/cache'}),
    resizeOptions = {
    	width: 400,
    	height: 400,
    	gravity: 'Center', // Leave this empty or set to 'smartcrop' to use smartcrop
    	quality: 80,
    	type: 'webp'
    };

// Resize the image and store it in the cache folder
veronica.getResizedImage('/path/to/original/image', resizeOptions, function(err, resizedPath) {
	// Do something with the path to the resized file
});
```

## Webp on Debian Wheezy

Debian Wheezy still uses an ancient version of webp, which doesn't even support
transparency. Because Wheezy also uses an old libc6 version, all the compiled
binaries out there won't install. You'll need to compile it yourself.

But it's quite easy to do:


Make sure libgif-div is installed (needed for gif support), automake and libtool
It'll install a few other packages, too, required for compiling

```bash
apt-get install automake libtool
```

Then clone the git repository
```bash
git clone https://chromium.googlesource.com/webm/libwebp
```

The last commit known to work is 9a463c4a516246edd705936c9c042ac492a2b56e
Now configure it, and enable all the options

```bash
cd libwebp
./autogen.sh
./configure --enable-everything
make
make install
```

And finally: update the libraries
```bash
ldconfig
```

The binary you need to use will be available in /usr/local/bin/cwebp
