-include .env
-include .devcontainer/.env

VENV=/home/vscode/venv
PYTHON=$(VENV)/bin/python
PIP=$(VENV)/bin/pip

install:
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

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

