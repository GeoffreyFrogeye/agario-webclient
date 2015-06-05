bundle.js: loader.js client/agario-client.js
		browserify $< -o $@ -i buffer-dataview
