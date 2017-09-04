# Development Guide

**Important**: Parts of this development guide are out-of-date.

## External Tracking System for Device Localization

During the development of this prototype we used the OptiTrack tracking system
by NaturalPoint to capture device locations. The server listens
(see [oscReceiver](server/utility/oscReceiver.ts)) on [OSC](http://opensoundcontrol.org/) network
messages containing the corresponding device locations.

As describe in the [README](README.md), the app can also be used without such a tracking
system.


## Setup and Run Project Within WebStorm

1. Load the root folder in WebStorm and open the **Project** tab.
2. Right-click on `package.json` and choose **Run 'npm install'** - this installs all required modules (dependencies).
3. In the menu, click on **Run** and **Edit Configurations...**.
4. In the new window, click **+** in the top left corner and choose **npm** from the dropdown list.
5. Enter `start vistiles` into the field **name**.
6. Enter `start` into the field **scripts**.
7. Click **Apply** and then **OK**.
8. Start the app via `Ctrl+R` or click the **Run** button (top right).


## Project Structure

The structure differs from the the default Express project structure:

| dir/file      | description  |
| ------------- | ------------ |
| (build)       | generated directory for transcompiled typescript files |
| client        | client source code |
| data          | data sets |
| (node_modules)| generated node directory for modules |
| public/       | browser (client) files (e.g., css, js) |
| server        | server source code |
| (storage)     | generated directory used as the servers' local storage |
| package.json  | package configuration (e.g., scripts, dependencies) |


## Used Packages

The app uses multiple npm packages:

| package       | description                  |
| ------------- | ---------------------------- |
| body-parser   | middleware parsing http body |
| cookie-parser | middleware parsing cookies   |
| winston       | logging                      |
| express       | Express app                  |
| jade          | Jade templates               |
| morgan        | http request logging         |
| serve-favicon | favicon                      |
| osc           | osc receiver / sender        |
| nconf         | config module                |
| socket.io     | websockets module            |
| node-sass     | Dependency for node-sass-middleware, required to force a specific version |
| node-sass-middleware | scss file renderer    |
