// Generator: defines tool used to generate ebook from image folder.
// Currently kcc is implemented ( https://github.com/ciromattia/kcc ), since it provides the best experience.
// Calibre is another tested -probably never to be implemented- possibility (by installing command line tools and using ebook-convert).
// The calibre workflow requires zipping the image folder and renaming it to .cbz, followed by
// something like 'ebook-convert input.cbz output.mobi --no-inline-toc --keep-aspect-ratio --output-profile=kindle_pw'
// (for kindle paperwhite)

this.generator = __dirname + '/generators/kcc.js';


// kcc: configures the specifics of the kcc generator

this.kcc = {

	// Path to comic2ebook script

	command: './kcc/kcc/comic2ebook.py',



	// Environment variable PYTHONPATH: only necessary if Pillow is installed but not found by default python installation
	// It's the location of the Pillow libraries
	// You can comment/delete this line if you don't need it

	environment: { 'PYTHONPATH': '/usr/local/lib/python2.7/site-packages'},



	// Here you can specify additional options as an array of strings; e.g. --nopanelviewhq
	// -c (cbz) is not (yet?) usable right now, -v, -t and -o are already used
	// Comment/delete if you don't need this

	options: //['--nopanelviewhq'],
		   ['-m', '--nopanelviewhq'],



	// Set kindlegen to empty string ('') if you don't want to generate a mobi from the kcc generated epub
	// Otherwise set it to the path where it can be found; if it's in your PATH, 'kindlegen' suffices

	kindlegen: 'kindlegen',



	// keePub = true -> kcc's ePub is not deleted, keePub = false -> the generated ePub is deleted
	// If kindlegen is '' AND keePub is false -> you end up without an ebook!

	keePub: false
}

