#Web-browser client for [agar.io](http://agar.io)
A small browser-based graphical client for agar.io, written using [pixijs](http://www.pixijs.com/) and [agario-client](https://github.com/pulviscriptor/agario-client).

**DISCLAIMER:** This project isn't affiliated with agar.io in any way. When playing with this client, you don't get ads, which is nice for you maybe, but it doesn't pay for the servers needed to run the game.

**Note:** You won't be able to play directly on agar.io servers due to cross origin policy restrictions. You must use a proxy (you can for example use the repeater you can find in [agario-devtools](https://github.com/pulviscriptor/agario-devtools)).

##Usage

* Clone the repo.
* Install [browserify](http://browserify.org/) globally `npm install -g browserify`
* Install [ws](http://einaros.github.io/ws/) locally `npm install ws`
* Install [agario-client](https://github.com/pulviscriptor/agario-client) locally `npm install agario-client`
* Run `make`
* Open `app.html` from the browser
