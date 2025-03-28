-include .env
-include .devcontainer/.env

install:
	pip install --upgrade pip
	pip install -r requirements.txt

lint:
	cd src && stubgen -p onbbu --output .
	cd src && black .

build:
	rm -fr dist
	python -m build

publish:
	twine upload dist/*
	rm -fr dist

publish-test:
	twine upload --repository testpypi dist/*

