bundle.js: loader.js client/agario-client.js
		browserify $< -o /tmp/agario-webclient-makefile -i buffer-dataview -i ws
		sed -i '/var WebSocket/d' $@
