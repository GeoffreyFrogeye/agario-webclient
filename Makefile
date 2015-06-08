FLAGS=''

main: out.js

debug: FLAGS += --debug
debug: out.js

out.js: script.js
		browserify $< -o $@ $(FLAGS)
