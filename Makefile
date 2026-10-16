.PHONY: check package format-check typecheck lint test build

# The package comes first: the test site takes it as an installed package.
check: package format-check typecheck lint test build

package:
	npm run --silent build

format-check:
	npm run --silent format:check

typecheck:
	npm run --silent typecheck

lint:
	npm run --silent lint

test:
	npm run --silent test

build:
	npm run --silent build:coffee-shop
