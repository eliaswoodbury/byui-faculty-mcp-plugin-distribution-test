# BYU-Idaho Faculty Pilot

This repository is a proof of concept for distributing a personal MCP app to faculty.

The included **BYU-Idaho Essay Grader** is self-contained. It includes the local MCP server, sample rubric, demo essay, and local grade storage. A faculty member who installs this plugin gets a separate local copy of the data.

## What this tests

1. A creator publishes one GitHub repository.
2. Another person gets the repository.
3. The ChatGPT desktop app discovers the included local marketplace.
4. The person installs the plugin as a personal plugin.
5. The plugin runs locally with no shared student data.

This is intentionally a small pilot. It does not yet require a hosted server, OAuth, or a shared database.
