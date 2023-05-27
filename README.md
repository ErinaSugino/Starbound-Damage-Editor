# Starbound Damage Editor
A web-based editor to easily create and edit Starbound's .damage files.

Working with custom data type is a powerful tool in Starbound modding. However, due to the lack of any proper documentation on what can and can't be done it's hard to work with. Just like many other things in Starbound, damage files can get overwhelmingly big and the slightest error can crash the entire game.

This lead to the demand of a better way to manage those damage files, and after not finding any dedicated tools for this matter I decided to create my own.

## Web Application
The `Starbound Damage Editor` is a web-based application for two major reasons.
One: I'm primarily a web-developer and working with JavaScript and co. is just several times easier than writing an actual program. After all, your browser deals with all the UI rendering, input management and security stuff all by itself.
Two: Instead of having a compiled program that you need to run, a web-application like this one is available to anyone who has a modern browser with no further dependencies required - something anyone actually planning on working with Starbound modding should have at least one of in the first place. No matter if run offline on your Desktop or via a remote webserver, it's as simple as can be.

## Features
The `Starbound Damage Editor` supports every feature Starbound itself accepts in a damage file, *based off of my own reverse engineering from what works in official game assets and other projects.* If there is anything not yet supported or a misunderstanding in how things work, create an [Issue](/../../issues) to let me know.

Currently missing features:
- "Variance" for particles

## Preview and Usage
The current build can be tested and the application seen in action at [this GitHub page](https://erinasugino.github.io/Starbound-Damage-Editor/).
Stable releases for public use can be found in the [Release section](/../../releases).
