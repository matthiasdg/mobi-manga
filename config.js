// generator: defines tool used to generate ebook from image folder.
// Currently kcc is implemented ( https://github.com/ciromattia/kcc ), since it provides the best experience.
// Calibre is another tested -not yet implemented- possibility (by installing command line tools and using ebook-convert).
// The calibre workflow requires zipping the image folder and renaming it to .cbz, followed by
// something like 'ebook-convert input.cbz output.mobi --no-inline-toc --keep-aspect-ratio --output-profile=kindle_pw'
// (for kindle paperwhite)

this.generator = __dirname + '/generators/kcc.js';



// kcc: configures the specifics of the kcc generator

this.kcc = {
	// PYTHONPATH: only necessary if Pillow is installed but not found by default python installation
	command: 'PYTHONPATH=/usr/local/lib/python2.7/site-packages ./kcc/kcc/comic2ebook.py',

	// Set kindlegen to empty string ('') if you don't want to generate a mobi from the kcc generated epub
	// Otherwise set it to the path where it can be found; if it's in PATH, 'kindlegen' suffices
	kindlegen: 'kindlegen',

	// keePub = true -> kcc's ePub is not deleted, keePub = false -> the generated ePub is deleted
	// if kindlegen is '' AND keePub is false -> you end up without an ebook!
	keePub: false
}

