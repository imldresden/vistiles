# VisTiles

The VisTiles prototype illustrates how multiple mobile devices can be combined
and coordinated for visual data exploration. The basic ideas and principles
behind this research prototype can be found in our publication:

> Ricardo Langner, Tom Horak and Raimund Dachselt, "VisTiles: Coordinating and
Combining Co-located Mobile Devices for Visual Data Exploration," in IEEE
Transactions on Visualization and Computer Graphics, vol. 24, no. 1, 2017.
doi: [10.1109/TVCG.2017.2744019](https://doi.org/10.1109/TVCG.2017.2744019)

**Project website**: Further information, photos, and videos can be found at
https://imld.de/vistiles/.

**Questions**: If you have any questions or you want to give feedback, please
contact Ricardo Langner
([institutional website](https://imld.de/en/our-group/team/ricardo-langner/),
[GitHub](https://github.com/derric)) or Tom Horak
([institutional website](https://imld.de/en/our-group/team/tom-horak/),
[GitHub](https://github.com/tomhorak21)).

## Installing and Running VisTiles

We developed and tested this prototype with
[Node.js](https://nodejs.org/) v6.
After installing Node and NPM, please execute the following commands.

If you start the app the first time, you have to install all required
dependencies ([see the list](package.json))
```
npm install
``` 

Start the app using our start script
```
npm start
```

If successful, the web server listens on
`http://<your-server-ip>:3000/` or `http://localhost:3000/`. 

First, you should open a new browser window and connect to to a debug console
via `http://<your-server-ip>:3000/debug`. This console allows you to simulate
the 2D position and orientation of connected devices.

To actually connect a device, open a new browser window and type
`http://<your-server-ip>:3000/`. Next, select an adequate device configuration
from the displayed list and click *NEXT*. Then, if you are not using an external
tracking system to capture device locations, click *SIMULATE*. Otherwise, you
can click *START PAIRING*. 

## Development

This project is developed by [Tom Horak](https://github.com/tomhorak21) and
[Ricardo Langner](https://github.com/derric) at the
[Interactive Media Lab Dresden](https://imld.de/),
Technische Universität Dresden, Germany.
Further development information can be found via the
[develpoment guide](DEVELOPMENT.md).

If you want to contribute, please check the
[contribution guide](CONTRIBUTING.md), fork our project, create a feature
branch for your changes, and provide us with a pull request.

## Acknowledgements

This research prototype uses the
[World Development Indicators](http://databank.worldbank.org/data/reports.aspx?source=world-development-indicators)
data set from [The World Bank](https://data.worldbank.org/).
Please check the specific [TERMS OF USE](http://go.worldbank.org/OJC02YMLA0)
for this data. 

We thank the following people for contributing to this project:
Dennis Esders, Nils Henning, Daniel Fuchs, and Dennis Metzger.






