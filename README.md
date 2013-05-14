# Mobi-Manga

Mobi-Manga is a webapp I built on [express 3](https://github.com/visionmedia/express/). The back-end acts as a proxy/scraper/ebook generator for [MangaFox](http://mangafox.me). The client (built with [bootstrap](https://github.com/twitter/bootstrap) and running fine in Kindle's experimental browser) allows you to search mangafox, and to request the creation, download or removal of ebooks generated from individual chapters or volumes.

## Background

After purchasing a Kindle Paperwhite and enjoying some "regular" ebooks on it, I thought about manga. A few years ago, I used to be quite a fan of the manga "GUNNM" (aka "Battle Angel Alita") and its continuation "GUNNM: Last Order". Although I bought most of the available volumes (in French, yay!) I also looked for scanlations on the Internet because I wanted to know the rest of the story. However, I didn't really like reading on a computer screen (pre-tablet era!) and I lost my interest. So after a lengthy manga hiatus I had the idea of trying to read manga (black-and-white anyway :-p ) on the PW. At first, I downloaded some .cbz/.cbr files and messed around in the indispensable [Calibre](http://calibre-ebook.com/) to create a .mobi the Kindle could display. I was quite satisfied with the result, stumbled upon MangaFox and had the idea of this project. When I ran some searches to check if something similar already existed I bumped into [KCC (KindleComicConvertor)](https://github.com/ciromattia/kcc). I read that it produced much better results than Calibre and decided to give it a go. I was convinced immediately (no margins!!, Panel View!!; didn't even know about the existence of Kindle Panel View before!) and decided to use KCC instead of Calibre command line tools. I didn't want to rely on an external database, so I decided to go for a simple text file to keep track of the generated ebooks and ended up using [nStore](https://github.com/creationix/nstore).

## Installation

The webapp uses node.js as a back-end. So make sure a recent version of [node.js](http://nodejs.org/ "Node.js") is installed and run:

    npm install

from within this repository's main folder. Mobi-Manga has KCC as a git submodule and uses its `comic2ebook` Python script. If you're already a user of this script, you can probably (= if there are no big differences between your version and mine) skip the next steps. Otherwise run:

    git submodule init
    git submodule update

This will fetch KCC from its GitHub repository. (This will be the version I used for my project; if you want the latest revision you can take the (small) risk by going into the kcc directory, checking out the master branch and performing a git pull).

KCC requires *Python* and *Pillow*. Since my Python knowledge is virtually non-existent I think this is the hardest part of the installation. On my Mac I used Homebrew to install Pillow. Well, actually I just found out I had installed PIL (brew install pil) instead of Pillow; I didn't have a clue about them being different forks and everything worked fine... [This link](http://www.derekkwok.net/2013/02/installing-pillow-pil-for-os-x-1/) explains how to install Pillow on a Mac.
Furthermore, you need to make sure Python can find the Pillow library. In the `config.js` file in the main folder, you can specify *environment variables* that will be passed to Python when running kcc (explanation in config.js). Python needs to be in your PATH.
In config.js you can also add or delete KCC options (e.g. to specify a different Kindle profile).

If you want to generate a .mobi you should also install Amazon's [kindlegen](http://www.amazon.com/gp/feature.html?ie=UTF8&docId=1000765211). Kindlegen converts the .epub generated by KCC into a .mobi file. In config.js you can specify whether to generate the .mobi or not.
There you can also decide to delete the .epub and only keep the .mobi or keep them both.

## Usage

From within the main folder, run:

    node app.js

This starts the web server. Now, you can access it with your browser on `http://localhost:3000` (or if you want to use your Kindle, replace localhost with the IP address of the computer running the server). I tested in Chrome and the Paperwhite's browser (and a little bit in Firefox).

The top navigation bar contains links to the following pages:
* *Mangafox*: this page displays mangafox's latest releases. The search box mimics mangafox's search.
* *Local*: this page displays series of which you have downloaded at least one volume or chapter. Search functionality is now limited to these series (pretty useless I guess, unless you would download a lot).

When you click through to a specific series, you get a page that lists all available volumes (black bars) and chapters (gray and white).

![Screenshot](http://localhost:3000/data/screenshot.png)
As you can see, there are three possible states for every volume or chapter, marked by an icon on the right. In the screenshot all individual *chapters* are in the initial state, marked by the download icon. Clicking such an item's bar will send a request for the total amount of pages in the selected volume/chapter. A pop-up will then ask for confirmation to generate an ebook with that number of pages.<br/>
In the same screenshot, volume 3 (above chapter 25) is in the second state; the ebook is being created (this involves downloading images, .epub/.mobi generation) and a progress bar as well as a sync icon are being displayed. It is perfectly fine to browse to another page or to exit the browser during this process.<br/>
Volume 2 is in the third state; ebook generation has succeeded and clicking the black bar will trigger a download of the .mobi (or .epub if your config says not to generate .mobi files). If you are using the Kindle, the file will be displayed in its Home screen after completion of the download. It seems you're not allowed to leave the Kindle browser while it is downloading (the download doesn't continue in the background), but it's fine to visit other web pages. The small button (with remove icon) on the right enables you to remove the generated book from the server and the database, which means the volume will end up in the initial state again. (Deleting books is probably easiest in a regular browser; in my experience the Kindle's touch doesn't work very well near the edges although pinching to zoom helps.)

## Troubleshooting

Next to installation problems, there shouldn't be many issues. Image downloading involves a few retries in case of failure so should normally finish without errors. In one case, I had a problem with the PIL imaging library and hence KCC: although a particular jpeg loaded fine in the browser when checking, I got an error from PIL: `IOError: image file is truncated (0 bytes not processed)`. If you experience this error, the server's console output will tell you which file is corrupt (Mobi-Manga uses KCC's verbose logging since it parses its output for the progress bars); i.e. the last file displayed on the screen. Then, you can look for an image editor that can open this file and replace it (I used Mac's Preview and exported it to .png and then back to .jpg). You can then convert the image folder manually using comic2ebook and kindlegen. If you still want the ebook in the database, you can manually enter it there. `mangas.db` in the data folder is an append only database, so you'll just have to copy the last line and insert the proper chapter and path (pretty straightforward if you look at the rest of the entries). Be careful you don't create any lines that do not contain valid database entries; e.g. if you press enter at the end of the last line and save the file, it will cause the server to crash because of the newly created empty line.

## Some Final Words

I started this project just for fun, and to see if it would be possible to perform all actions from the Kindle itself; there are already a lot of scripts that allow you to download manga, but I wanted something more convenient. It's by no means my intention to overuse this or to set up a public server (in that case I would have opted for a "real" NoSQL database :-p ), and I hope it isn't yours.