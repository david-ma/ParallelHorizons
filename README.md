Gallery
===========

This is a digital twin of David Ma's first solo photography exhibition, using code originally written by OwlSketch.

This version of the gallery can be visited at [https://www.david-ma.net/gallery](https://www.david-ma.net/gallery).

I have uploaded this code as example code for the Monash class CDS2704 - Web design - S1 2023.


Quickstart:

1. Clone the repository
2. `npm install` in the root directory
3. `npm start` to start the server
4. Navigate to `localhost:8888/gallery` in your browser

Todo:
* Clean it up so it can run from the public folder
* Make it easier to for others to change their images
* Add descriptions / labels for images
* Dynamic floor layout
* Make it more mobile friendly, giving the user their own navigation

===========

From @OwlSketch:
Online automated art gallery based on your search input.

There is now a functional alpha version currently being hosted at [owlsketch.com/gallery](http://www.owlsketch.com/gallery)

This program is based on two programs. A python web scraper, that gets the images of your favorite artist from http://www.metmuseum.org/collection/the-collection-online, and a webGL/ThreeJs application that dynamically makes your own art gallery.

![Alt text](https://cloud.githubusercontent.com/assets/5739127/12076105/bf8f3b08-b16b-11e5-9cd9-f7951574b60a.png "Gallery Image")


#Current Release
##v0.1-alpha.2

The following has been implemented:

1. Menu for pause screen and rendering pause

2. Ray Cast selection of individual paintings

3. Player object collision against walls and other objects

4. Imported 3D objects successfully loaded

#Next Release
##v0.1-alpha.3

The implementations (in order of priority) for the next release will be:

1. Sub-menu for controls and credits sections

2. Allow control re-mapping and sensitivity adjustment

3. Import "missing" 3D elements for sample scene (Molding, lights, frames)

# Structure 
App structure is as follows:

		---> gallery application menu
			---> enter scene --> painting selection ---> displays information on painting
			---> search input for different artists ---> new gallery application


