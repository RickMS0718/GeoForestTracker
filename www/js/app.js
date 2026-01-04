
// Globals

// Cordova

var fileObject;

// Geolocation

var watchID = null; // null = geolocation disabled, not null = geolocation enabled

var point = {
	"id": null,
	"type": "Feature",
	"geometry": {
		"type": "Point",
		"coordinates": []
	},
	"properties": {
		"utm": {
			"x": null, 
			"y": null, 
			"zone": null
		},
		"dms": {
			"latitude": {
				"degrees": null, 
				"minutes": null,
				"seconds": null,
				"hemisphere": null
			},
			"longitude": {
				"degrees": null, 
				"minutes": null,
				"seconds": null,
				"hemisphere": null				
			}
		}
	}
}

var geolocationOptions = {
	enableHighAccuracy: true,
	timeout: 10000 // milliseconds
}

var pointArray = [];


// Leaflet

var map = L.map("map", {zoomControl: false}); // L: root element of Leaflet

var osmURL = "https://{s}.tile.osm.org/{z}/{x}/{y}.png";
var osmAttribution = "&copy <a href=\"https://openstreetmap.org/copyright\">OpenStreetMap</a> contributors";

var osm = L.tileLayer(osmURL, {attribution: osmAttribution});

map.setView([40, -3.5], 6); // Centered on Spain

map.addLayer(osm);


var leafletPointOptions = {
    radius: 20, // Adapt to every device
	color: "blue",
	fillOpacity: 0.8
};

var leafletPointArray = [];


// Multilayer

var currentLayer = "osm";

// PNOA stands for Plan Nacional de Ortofotografía Aérea

var pnoa = L.tileLayer.wms(
	"https://www.ign.es/wms-inspire/pnoa-ma?SERVICE=WMS&",
	{
		layers: "OI.OrthoimageCoverage", // Layer name
		transparent: true,
		format: "image/jpeg",
		version: "1.3.0",
		attribution: "&copy; CNIG"
	}
);

// SIOSE - Sistema de Información sobre Ocupación del Suelo de España
var siose = L.tileLayer.wms(
	"https://servicios.idee.es/wms-inspire/ocupacion-suelo",
	{
		layers: "LC.LandCoverSurfaces",
		format: "image/png",
		transparent: false,
		version: "1.3.0",
		crs: L.CRS.EPSG4326,
		attribution: "&copy; IGN - SIOSE"
	}
);

var baseMaps = {
	"osm": osm,
	"pnoa": pnoa,
	"siose": siose
}


// Cordova specific event listener to start app

document.addEventListener("deviceready", onDeviceReady, false);

// App starts here

function onDeviceReady() {
	//showToast("onDeviceReady()");
	
	// Click events
	
	document.getElementsByClassName("fa-solid fa-location-dot")[0].addEventListener("click", toggleLocation);
	document.getElementsByClassName("fa-solid fa-square-plus")[0].addEventListener("click", storePoint);
	document.getElementsByClassName("fa-solid fa-square-minus")[0].addEventListener("click", openDeleteModal);
	document.getElementsByClassName("fa-solid fa-layer-group")[0].addEventListener("click", toggleBasemapSelect);

	// Basemap dropdown change
	var basemapSelect = document.getElementById("basemap-select");
	basemapSelect.addEventListener("change", function(e){
		var choice = e.target.value;
		switchBaseMap(choice);
	});

	// Botón: visualizar todos los puntos guardados
	document.getElementsByClassName("fa-solid fa-map-pin")[0].addEventListener("click", showAllPoints);

	document.getElementsByClassName("fa-solid fa-floppy-disk")[0].addEventListener("click", saveGeoJSON);

	// Form buttons
	document.getElementById("attr-save").addEventListener("click", saveAttributesForm);
	document.getElementById("attr-cancel").addEventListener("click", closeAttributesForm);
	
	// Delete modal buttons
	document.getElementById("delete-selected-btn").addEventListener("click", deleteSelectedPoints);
	document.getElementById("delete-all-btn").addEventListener("click", deleteAllPoints);
	document.getElementById("cancel-delete-btn").addEventListener("click", closeDeleteModal);

}

// Fallback para entorno navegador (sin Cordova): registrar listeners cuando DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
	if (typeof window.cordova === 'undefined') {
		// Llamar directamente para que los listeners se registren en entorno web
		try {
			onDeviceReady();
		} catch (e) {
			console.warn('onDeviceReady fallback failed:', e);
		}
	}
});


// Geolocation functions

function toggleLocation() {
	//showToast("toggleLocation()");
	
	if (watchID === null) {
		// Start geolocation
		showToast("Starting geolocation service.");
		watchID = navigator.geolocation.watchPosition(
			geolocationSuccess, geolocationError, geolocationOptions
		);
		document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "cyan";
	} else {
		// Stop geolocation
		showToast("Stopping geolocation service.");
		navigator.geolocation.clearWatch(watchID);
		watchID = null;
		document.getElementsByClassName("fa-solid fa-location-dot")[0].style.color = "black";		
	}
}


function getLocation() {
	//alert("getLocation()");
	
	// HTML5 Geolocation: IP address, WiFi, GPS receiver
	
	// Check browser Geolocation support
	if (navigator.geolocation) {
		//alert("Starting geolocation service.");
		showToast("Starting geolocation service.");
		navigator.geolocation.getCurrentPosition(
			geolocationSuccess, geolocationError, geolocationOptions
		);
	} else {
		//alert("Geolocation service not supported.");
		showToast("Geolocation service not supported.");
	}
}

function formatCoordinates(format="geo") {
	
	var separator = "&nbsp;&nbsp;&nbsp;&nbsp;"; // &nbsp; = HTML blank space
	var coordinateString = "";
	
	if (format == "geo") {
		coordinateString += point.geometry.coordinates[1].toFixed(8);
		coordinateString += separator;
		coordinateString += point.geometry.coordinates[0].toFixed(8);
		coordinateString += separator;
		coordinateString += "[" + point.properties.accuracy.toFixed(2) + "]";
	}
	
	return coordinateString;
}

function geolocationSuccess(position) {
	point.geometry.coordinates = [position.coords.longitude, position.coords.latitude];

	point.properties.accuracy = position.coords.accuracy;
	point.properties.timestamp = position.timestamp;
	
	document.getElementById("coordinates-text").innerHTML = formatCoordinates();
	
	// UTM
	
	var zone =  Math.trunc(31 + (position.coords.longitude / 6));
	
	var source = "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs +type=crs";
	var target = "+proj=utm +zone=" + zone + " +ellps=GRS80 +units=m +no_defs +type=crs";
	
	var projected = proj4(
		source, 
		target, 
		[position.coords.longitude, position.coords.latitude]
	);
	
	point.properties.utm.x = projected[0];
	point.properties.utm.y = projected[1];
	point.properties.utm.zone = zone;
	
	// DMS
	
	// Latitude
	
	var hemisphere = "N";
	var latitude = position.coords.latitude;
	
	if (latitude < 0.0) {
		hemisphere = "S";
		latitude = Math.abs(latitude);
	}
	
	var degrees = latitude | 0; // | Bitwise OR
	var minutes = ((latitude - degrees) * 60) | 0;
	var seconds = (((latitude - degrees) * 60) % 1) * 60;   // % = Modulo
	
	point.properties.dms.latitude.degrees = degrees
	point.properties.dms.latitude.minutes = minutes
	point.properties.dms.latitude.seconds = seconds
	point.properties.dms.latitude.hemisphere = hemisphere
	
	// Longitude
	
	var hemisphere = "E";
	var longitude = position.coords.longitude;
	
	if (longitude < 0.0) {
		hemisphere = "W";
		longitude = Math.abs(longitude);
	}
	
	var degrees = longitude | 0; // | Bitwise OR
	var minutes = ((longitude - degrees) * 60) | 0;
	var seconds = (((longitude - degrees) * 60) % 1) * 60;   // % = Modulo
	
	point.properties.dms.longitude.degrees = degrees
	point.properties.dms.longitude.minutes = minutes
	point.properties.dms.longitude.seconds = seconds
	point.properties.dms.longitude.hemisphere = hemisphere
	
	
	console.log(JSON.stringify(point, null, 4));
}
	

function geolocationError(error) {
	switch(error.code) {
		case error.PERMISSION_DENIED:
			//alert("Geolocation request denied.");
			showToast("Geolocation request denied.");
			break;
		case error.POSITION_UNAVAILABLE:
			//alert("Position unavailable.");
			showToast("Position unavailable.");
			break;
		case error.TIMEOUT:
			//alert("Geolocation request timed out.");
			showToast("Geolocation request timed out.");
			break;
		case error.UNKNOWN_ERROR:
			//alert("Unknown geolocation error.");
			showToast("Unknown geolocation error.");
			break;
	}
}



// User functions

function toggleIDBox() {

	//alert("toggleIDBOX()");
	
	var pointID = document.getElementById("point-id");
	
	if (pointID.style.display == "none") {
		// Now it is invisible
		pointID.style.display = "block";
		// Now it is vivible
	} else if (pointID.style.display == "block") {
		pointID.style.display = "none";
	}
}

function storePoint() {
	//showToast("storePoint()");
	
	// Check there are coordinates
	if (point.geometry.coordinates[0] == null || point.geometry.coordinates[1] == null) {
		// Si no hay coordenadas, pedir una posición puntual antes de guardar
		if (navigator.geolocation) {
			showToast("Obteniendo coordenadas, espera...");
			navigator.geolocation.getCurrentPosition(
				function(position) {
					// Reutilizar la lógica de éxito para poblar 'point'
					geolocationSuccess(position);
					// Llamar de nuevo a storePoint ahora que hay coordenadas
					storePoint();
				},
				function(error) {
					geolocationError(error);
				},
				geolocationOptions
			);
			return;
		} else {
			showToast("Geolocation service not supported.");
			return;
		}
	}
	
	// || = Logical OR
	
	// Counter
	
	var counter = pointArray.length;
	var counterPointID = String(counter).padStart(4, "0");
	
	// Get point ID from text box
	
	var pointIDText = document.getElementById("point-id-text");
	
	if (pointIDText.value.trim() === "") {
		// trim(): removes blanks at the beginning and end of the string
		point.id = counterPointID;
	} else {
		var pointIDValue = pointIDText.value.trim();
		point.id = pointIDValue;
	}
	
	// Properties
	point.properties.count = counterPointID;
	
	
	
	// TODO: convert to UTM and store in
	// point.properties.utm.x
	// point.properties.utm.y
	// point.properties.utm.zone
	// using a new function geoToUTM(longitude, latitude)
	
	// Add to array of points
	pointArray.push(JSON.parse(JSON.stringify(point))); // Weird but works
	
	// Empty text box
	pointIDText.value = "";
	
	// Hide text box
	var pointID = document.getElementById("point-id");
	
	if (pointID.style.display == "block") {
		pointID.style.display = "none";
	}
	
	console.log(JSON.stringify(pointArray, null, 4));
	
	// Leaflet point con icono de árbol
	
	var treeIcon = L.divIcon({
		html: '<i class="fa-solid fa-tree" style="color: green; font-size: 24px;"></i>',
		className: 'tree-marker',
		iconSize: [24, 24],
		iconAnchor: [12, 24]
	});
	
	var leafletPointID = L.marker(
	    point.geometry.coordinates.toReversed(),
		{icon: treeIcon}
	);
	
	var popup = "";
	
	popup += "ID = " + point.id + "<br>";
	popup += "Longitude = " + point.geometry.coordinates[0].toFixed(8) + "<br>";
	popup += "Latitude = " + point.geometry.coordinates[1].toFixed(8) + "<br>";
	
	leafletPointID.bindPopup(popup);
	
	leafletPointID.addTo(map); // Draw point marker
	
	leafletPointArray.push(leafletPointID); // Keep leaflet marker reference

	// Abrir el formulario de atributos automáticamente para el punto recién guardado
	openAttributesForm();
}

function openDeleteModal() {
	if (pointArray.length === 0) {
		showToast("No hay puntos guardados.");
		return;
	}
	
	// Generar lista de puntos
	var pointsList = document.getElementById("points-list");
	pointsList.innerHTML = "";
	
	for (var i = 0; i < pointArray.length; i++) {
		var p = pointArray[i];
		var pointItem = document.createElement("div");
		pointItem.className = "point-item";
		
		var checkbox = document.createElement("input");
		checkbox.type = "checkbox";
		checkbox.value = i;
		checkbox.id = "point-checkbox-" + i;
		
		var label = document.createElement("label");
		label.htmlFor = "point-checkbox-" + i;
		label.style.cursor = "pointer";
		label.style.flex = "1";
		
		var pointInfo = "ID: " + p.id;
		if (p.properties.especie) {
			pointInfo += " - " + p.properties.especie;
		}
		label.textContent = pointInfo;
		
		pointItem.appendChild(checkbox);
		pointItem.appendChild(label);
		pointsList.appendChild(pointItem);
	}
	
	document.getElementById("delete-points-modal").style.display = "flex";
}

function closeDeleteModal() {
	document.getElementById("delete-points-modal").style.display = "none";
}

function deleteSelectedPoints() {
	var checkboxes = document.querySelectorAll("#points-list input[type='checkbox']:checked");
	
	if (checkboxes.length === 0) {
		showToast("Selecciona al menos un punto para eliminar.");
		return;
	}
	
	var confirm = window.confirm("¿Eliminar " + checkboxes.length + " punto(s) seleccionado(s)?");
	if (!confirm) return;
	
	// Obtener índices en orden descendente para eliminar correctamente
	var indices = [];
	for (var i = 0; i < checkboxes.length; i++) {
		indices.push(parseInt(checkboxes[i].value));
	}
	indices.sort(function(a, b) { return b - a; });
	
	// Eliminar puntos del array y del mapa
	for (var i = 0; i < indices.length; i++) {
		var idx = indices[i];
		pointArray.splice(idx, 1);
		if (leafletPointArray[idx]) {
			map.removeLayer(leafletPointArray[idx]);
			leafletPointArray.splice(idx, 1);
		}
	}
	
	showToast(checkboxes.length + " punto(s) eliminado(s).");
	closeDeleteModal();
}

function deleteAllPoints() {
	var confirm = window.confirm("¿Eliminar TODOS los puntos guardados (" + pointArray.length + ")?");
	if (!confirm) return;
	
	// Limpiar array de puntos
	pointArray = [];
	
	// Limpiar marcadores del mapa
	for (var i = 0; i < leafletPointArray.length; i++) {
		map.removeLayer(leafletPointArray[i]);
	}
	leafletPointArray = [];
	
	showToast("Todos los puntos han sido eliminados.");
	closeDeleteModal();
}

function clearMemory() {
	
	if (pointArray.length === 0) {
		showToast("There are no data collected yet.");
		return;
	}
	
	// Ask to clear memory
	var clear = confirm("All collected data will be removed. Proceed?");
	
	//console.log(clear);
	
	if (!clear) {
		// ! = logical not operator
		return;
	}
	
	// Clear memory contents
	
	pointArray = []
	
	point = {
		"id": null,
		"type": "Feature",
		"geometry": {
			"type": "Point",
			"coordinates": []
		},
		"properties": {"utm": {"x": null, "y": null, "zone": null}}
	}	
	
	console.log(JSON.stringify(pointArray, null, 4));
	
	// Clear leaflet points
	
	for (var count = 0; count < leafletPointArray.length; count++) {
		map.removeLayer(leafletPointArray[count]);
	}
	
	leafletPointArray = [];
}


function switchBaseMap(choice) {
	if (!choice) return;
	choice = choice.trim().toLowerCase();
	if (!baseMaps[choice]) {
		showToast("Capa no válida: " + choice);
		return;
	}
	if (baseMaps[currentLayer] && map.hasLayer(baseMaps[currentLayer])) {
		map.removeLayer(baseMaps[currentLayer]);
	}
	map.addLayer(baseMaps[choice]);
	currentLayer = choice;
	
	// Mostrar/ocultar leyenda SIOSE
	var legend = document.getElementById("siose-legend");
	if (legend) {
		legend.style.display = (choice === "siose") ? "block" : "none";
	}
}

function toggleBasemapSelect() {
	var select = document.getElementById("basemap-select");
	if (!select) return;
	// Toggle visibility
	select.style.display = (select.style.display === "none" || select.style.display === "") ? "inline-block" : "none";
	// Sync current selection
	select.value = currentLayer;
}

function showAllPoints() {
	if (pointArray.length === 0) {
		showToast("No hay puntos guardados.");
		return;
	}

	// Limpiar marcadores existentes del mapa
	for (var i = 0; i < leafletPointArray.length; i++) {
		map.removeLayer(leafletPointArray[i]);
	}
	leafletPointArray = [];

	// Crear icono de árbol
	var treeIcon = L.divIcon({
		html: '<i class="fa-solid fa-tree" style="color: green; font-size: 24px;"></i>',
		className: 'tree-marker',
		iconSize: [24, 24],
		iconAnchor: [12, 24]
	});

	// Dibujar todos los puntos guardados
	for (var count = 0; count < pointArray.length; count++) {
		var p = pointArray[count];
		
		var leafletPointID = L.marker(
			p.geometry.coordinates.toReversed(),
			{icon: treeIcon}
		);
		
		var popup = "";
		popup += "ID = " + p.id + "<br>";
		popup += "Longitude = " + p.geometry.coordinates[0].toFixed(8) + "<br>";
		popup += "Latitude = " + p.geometry.coordinates[1].toFixed(8) + "<br>";
		if (p.properties.especie) popup += "Especie = " + p.properties.especie + "<br>";
		if (p.properties.altura !== null && p.properties.altura !== undefined) popup += "Altura (m) = " + p.properties.altura + "<br>";
		if (p.properties.dap !== null && p.properties.dap !== undefined) popup += "DAP (m) = " + p.properties.dap + "<br>";
		if (p.properties.estado_fito) popup += "Estado fito = " + p.properties.estado_fito + "<br>";
		if (p.properties.cobertura) popup += "Cobertura = " + p.properties.cobertura + "<br>";
		if (p.properties.observaciones) popup += "Observaciones = " + p.properties.observaciones + "<br>";
		
		leafletPointID.bindPopup(popup);
		leafletPointID.addTo(map);
		leafletPointArray.push(leafletPointID);
	}

	showToast("Mostrando " + pointArray.length + " punto(s).");
}


function saveGeoJSON() {
	//alert("saveJSON()");
	
	alert(cordova.file.externalDataDirectory);
	
	if (pointArray.length === 0) {
		showToast("There are no data collected yet.");
		return;
	}
    
	var geojson = {"type": "FeatureCollection", "features": pointArray};
	
	var filename = window.prompt("Filename", "test.geojson");
	
	// Cordova file processing (callbacks)
	
	window.resolveLocalFileSystemURL(
		cordova.file.externalDataDirectory,
		function(directoryEntry){
			//alert(JSON.stringify(directoryEntry, null, 4));
			
			directoryEntry.getFile(
			    filename,
			    {create: true}, // File will be created on device
			    function(file) {
			        fileObject = file; // File object in Cordova
			        writeFile(JSON.stringify(geojson, null, 4)); // defined by user
			    }
			);
			
			// TODO later
			
		}
	);
}


// Atributos: abrir/guardar formulario

function openAttributesForm() {
	// Verificar que haya al menos un punto guardado
	if (pointArray.length === 0) {
		showToast("No hay puntos guardados. Guarda un punto primero.");
		return;
	}

	var lastIndex = pointArray.length - 1;
	var p = pointArray[lastIndex];

	// Rellenar formulario con valores existentes si los hay
	document.getElementById("attr-especie").value = p.properties.especie || "";
	document.getElementById("attr-altura").value = (p.properties.altura !== undefined && p.properties.altura !== null) ? p.properties.altura : "";
	document.getElementById("attr-dap").value = (p.properties.dap !== undefined && p.properties.dap !== null) ? p.properties.dap : "";
	document.getElementById("attr-estado").value = p.properties.estado_fito || "";
	document.getElementById("attr-cobertura").value = p.properties.cobertura || "";
	document.getElementById("attr-observaciones").value = p.properties.observaciones || "";

	document.getElementById("attributes-form").style.display = "block";
}

function closeAttributesForm() {
	document.getElementById("attributes-form").style.display = "none";
}

function saveAttributesForm() {
	if (pointArray.length === 0) {
		showToast("No hay puntos para guardar atributos.");
		return;
	}

	var lastIndex = pointArray.length - 1;
	var p = pointArray[lastIndex];

	// Leer campos
	var especie = document.getElementById("attr-especie").value.trim();
	var altura = document.getElementById("attr-altura").value;
	var dap = document.getElementById("attr-dap").value;
	var estado = document.getElementById("attr-estado").value; // select value
	var cobertura = document.getElementById("attr-cobertura").value.trim();
	var observaciones = document.getElementById("attr-observaciones").value.trim();

	// Asignar a properties del punto
	p.properties.especie = especie;
	p.properties.altura = (altura === "") ? null : parseFloat(altura);
	p.properties.dap = (dap === "") ? null : parseFloat(dap);
	p.properties.estado_fito = estado;
	p.properties.cobertura = cobertura;
	p.properties.observaciones = observaciones;

	// Actualizar popup del marcador correspondiente si existe
	if (leafletPointArray[lastIndex]) {
		var popup = "";
		popup += "ID = " + p.id + "<br>";
		popup += "Longitude = " + p.geometry.coordinates[0].toFixed(8) + "<br>";
		popup += "Latitude = " + p.geometry.coordinates[1].toFixed(8) + "<br>";
		if (p.properties.especie) popup += "Especie = " + p.properties.especie + "<br>";
		if (p.properties.altura !== null && p.properties.altura !== undefined) popup += "Altura (m) = " + p.properties.altura + "<br>";
		if (p.properties.dap !== null && p.properties.dap !== undefined) popup += "DAP (m) = " + p.properties.dap + "<br>";
		if (p.properties.estado_fito) popup += "Estado fito = " + p.properties.estado_fito + "<br>";
		if (p.properties.cobertura) popup += "Cobertura = " + p.properties.cobertura + "<br>";
		if (p.properties.observaciones) popup += "Observaciones = " + p.properties.observaciones + "<br>";

		leafletPointArray[lastIndex].bindPopup(popup);
	}

	showToast("Atributos guardados.");
	closeAttributesForm();
}


function writeFile(geoJSONString) {

	// Check fileObject has content
	if (!fileObject) {
	    return
	}
	
	// Create a "writer" object
	
	fileObject.createWriter( // creteWriter is a Cordova file plugin method
	    function(fileWriter) { // function run on success
	        fileWriter.seek(0); // Go to file origin, i.e. byte 0, and overwrite
	        
	        // Data to be saved: class Blob
	        var blob = new Blob([geoJSONString], {type: "text/json"});
	        
	        // Write data
	        fileWriter.write(blob);
	    },
	    function(error) { // function run on error
	        alert("File system error: \n" + JSON.stringify(error, null, 4))
	    }
	);
	
	alert("File saved.");
}



function showToast(message) {

	var toast = document.getElementById("toast");
	
	toast.innerHTML = message;
	
	toast.style.display = "block"; // toast is visible
	
	setTimeout(
		function(){ // Anonymous function
			toast.style.display = "none";
		}, 
		5000 // delay = 5000 milliseconds
	);
}



/*

// Global variables

var jsonObject;


function readJSON() {
	// alert("readJSON()");
	
	var url = "https://valencia.opendatasoft.com/api/explore/v2.1/catalog/datasets/carregadors-vehicles-electrics-cargadores-vehiculos-electricos/exports/json?lang=es&timezone=Europe%2FBerlin";
	
	// Pattern to send GET requests
	
	// 1. Create XHR instance
	
	var xhr = new XMLHttpRequest();
	
	// 2. Open and send request
	
	xhr.open("GET", url, true);
	
	// Parameter 1: HTTP verb
	// Parameter 2: URL
	// Parameter 3: true=asynchronous, false=synchronous
	
	xhr.send();
	
	// 3. Get response
	
	xhr.onreadystatechange = function() { // Anonymous function
		if (xhr.readyState == 4 && xhr.status == 200) {
			// JS notation: && is the logical AND
			// If reach this point we have data
			
			// JS notation: var defines local variables
			
			
			var jsonText = xhr.responseText;
			
			jsonObject = JSON.parse(jsonText); // Global variable
			
			var jsonTextDuplicate = JSON.stringify(jsonObject, null, 4);
			
			// document = HTML page
			
			var textBox = document.getElementById("text-box");
			textBox.innerHTML = jsonTextDuplicate;
			
			console.log(jsonText);
			
		}
	}
}


function saveJSON() {
	//alert("saveJSON()");
	
	if (typeof jsonObject == "undefined") {
		alert("Download the data before saving.");
		return;
	}
	
	// Save data to local disk (4 steps)
	
	// 1. MIME (Multpurpose Internet Mail Extension)

	var mime = "data:application/json;charset=utf-8,"; // Header of data
	
	
	// 2. Create <a> with JS (a=anchor)
	
	var saveLink = document.createElement("a");

	saveLink.setAttribute("href", mime + encodeURI(JSON.stringify(jsonObject, null, 4)));
	saveLink.setAttribute("download", "charge.json"); // Data file
	
	
	// 3. Add <a> to HTML
	
	document.body.appendChild(saveLink);
	
	
	// 4. Click on <a> (virtual)
	saveLink.click();
}


function readLocalCSV() {
	
	var url = "./files/random_5000.csv";
	
	// Pattern to send GET requests
	
	// 1. Create XHR instance
	
	var xhr = new XMLHttpRequest();
	
	// 2. Open and send request
	
	xhr.open("GET", url, true);
	
	// Parameter 1: HTTP verb
	// Parameter 2: URL
	// Parameter 3: true=asynchronous, false=synchronous
	
	xhr.overrideMimeType("text/csv");
	
	xhr.send();
	
	// 3. Get response
	
	xhr.onreadystatechange = function() { // Anonymous function
		if (xhr.readyState == 4 && xhr.status == 200) {
			// JS notation: && is the logical AND
			// If reach this point we have data
			
			// JS notation: var defines local variables
			
			var csvData = xhr.responseText;
			
			// document = HTML page
			
			var textBox = document.getElementById("text-box");
			textBox.innerHTML = csvData;
			
			console.log(csvData);
			
		}
	}
}





function readLocalJSON() {
	// alert("readJSON()");
	
	var url = "./files/Tra_recarga_electrica.JSON";
	
	// Pattern to send GET requests
	
	// 1. Create XHR instance
	
	var xhr = new XMLHttpRequest();
	
	// 2. Open and send request
	
	xhr.open("GET", url, true);
	
	// Parameter 1: HTTP verb
	// Parameter 2: URL
	// Parameter 3: true=asynchronous, false=synchronous
	
	xhr.send();
	
	// 3. Get response
	
	xhr.onreadystatechange = function() { // Anonymous function
		if (xhr.readyState == 4 && xhr.status == 200) {
			// JS notation: && is the logical AND
			// If reach this point we have data
			
			// JS notation: var defines local variables
			
			
			var jsonText = xhr.responseText;
			
			jsonObject = JSON.parse(jsonText); // Global variable
			
			var jsonTextDuplicate = JSON.stringify(jsonObject, null, 4);
			
			// document = HTML page
			
			var textBox = document.getElementById("text-box");
			textBox.innerHTML = jsonTextDuplicate;
			
			console.log(jsonText);
			
		}
	}
}




function utmToGeo() {
	//alert("utmToGeo()");
	
	if (typeof jsonObject == "undefined") {
		alert("Download data before processing.");
		return;
	}
	
	// Coordinate transformation
	
	// Source and target CRSs using PROJ format strings
	
	proj4.defs("EPSG:25830", "+proj=utm +zone=30 +ellps=GRS80 +units=m +no_defs");
	proj4.defs("EPSG:4326", "+proj=longlat +ellps=WGS84 +datum=WGS84 +no_defs");
	
	// Parameter 1: Alias
	// Parameter 2: PROJ String
	
	// Process GeoJSON
	
	for (var count=0; count < jsonObject.features.length; count++) {
		
		//console.log(count);
		
		// 1. Get UTM coordinates
		
		var utmPoint = jsonObject.features[count].geometry.coordinates;
		console.log(utmPoint);
		
		// 2. Convert to Geographic
		
		var geoPoint = proj4(proj4("EPSG:25830"), proj4("EPSG:4326"), utmPoint);
		
		// Parameter 1: source CRS 25830
		// Parameter 2: target CRS 4326
		// Parameter 3: point to be transformed
		
		console.log(geoPoint);
		
		// 3. Update coordinates in GeoJSON
		
		jsonObject.features[count].geometry.coordinates = geoPoint;
		
		// 4. Keep UTM coordinates in properties
		
		jsonObject.features[count].properties.utm = utmPoint;
	}
	
	// Remove "crs" entry
	
	delete jsonObject.crs
	
	// Update text box
	
	var textBox = document.getElementById("text-box");
	
	textBox.innerHTML = ""; // Empty
	textBox.innerHTML = JSON.stringify(jsonObject, null, 4);
}


// Exercise 8 Geolocation

// Globals

var point = {
	"type": "Feature",
	"geometry": {
		"type": "Point",
		"coordinates": []
	},
	"properties": {}
}

var geolocationOptions = {
	enableHighAccuracy: true,
	timeout: 10000 // milliseconds
}

function getLocation() {
	//alert("getLocation()");
	
	// HTML5 Geolocation: IP address, WiFi, GPS receiver
	
	// Check browser Geolocation support
	if (navigator.geolocation) {
		//alert("Starting geolocation service.");
		showToast("Starting geolocation service.");
		navigator.geolocation.getCurrentPosition(
			geolocationSuccess, geolocationError, geolocationOptions
		);
	} else {
		//alert("Geolocation service not supported.");
		showToast("Geolocation service not supported.");
	}
}

function formatCoordinates(format="geo") {
	
	var separator = "&nbsp;&nbsp;&nbsp;&nbsp;"; // &nbsp; = HTML blank space
	var coordinateString = "";
	
	if (format == "geo") {
		coordinateString += point.geometry.coordinates[1].toFixed(8);
		coordinateString += separator;
		coordinateString += point.geometry.coordinates[0].toFixed(8);
		coordinateString += separator;
		coordinateString += "[" + point.properties.accuracy.toFixed(2) + "]";
	}
	
	return coordinateString;
}

function geolocationSuccess(position) {
	point.geometry.coordinates = [position.coords.longitude, position.coords.latitude];

	point.properties.accuracy = position.coords.accuracy;
	point.properties.timestamp = position.timestamp;
	
	document.getElementById("coordinates-text").innerHTML = formatCoordinates();
	
	console.log(JSON.stringify(point, null, 4));
}
	

function geolocationError(error) {
	switch(error.code) {
		case error.PERMISSION_DENIED:
			//alert("Geolocation request denied.");
			showToast("Geolocation request denied.");
			break;
		case error.POSITION_UNAVAILABLE:
			//alert("Position unavailable.");
			showToast("Position unavailable.");
			break;
		case error.TIMEOUT:
			//alert("Geolocation request timed out.");
			showToast("Geolocation request timed out.");
			break;
		case error.UNKNOWN_ERROR:
			//alert("Unknown geolocation error.");
			showToast("Unknown geolocation error.");
			break;
	}
}





// Exercise 9 - Watch geolocation

var watchID = null; // null = geolocation disabled, not null = geolocation enabled

function toggleLocation() {
	//showToast("toggleLocation()");
	
	if (watchID === null) {
		// Start geolocation
		showToast("Starting geolocation service.");
		watchID = navigator.geolocation.watchPosition(
			geolocationSuccess, geolocationError, geolocationOptions
		);
		
		document.getElementsByClassName("fa-solid fa-map-marker-alt")[0].style.color = "cyan";
	} else {
		// Stop geolocation
		showToast("Stopping geolocation service.");
		navigator.geolocation.clearWatch(watchID);
		watchID = null;
		document.getElementsByClassName("fa-solid fa-map-marker-alt")[0].style.color = "black";		
	}
}

// Example 10 - Maps

var map = L.map("map", {zoomControl: false}); // L: root element of Leaflet

// Tile map server (OpenStreetMap)
var osmURL = "https://{s}.tile.osm.org/{z}/{x}/{y}.png";

// s: server
// z: zoom level
// x: column
// y: row


// Leaflet layer

var osm = L.tileLayer(osmURL);

// Show map

map.setView([0.0, 0.0], 1);

// [0.0, 0.0] coordinates at screen center
// 1: Zoom level 1. Zoom ranges from 0 (out) - 18 (in)

map.addLayer(osm);


function centerMap() {
	//showToast("centerMap()");
	
	if (point.geometry.coordinates.length === 0) {
		showToast("Geolocation not available.");
		return;
	}
	
	// Leaflet wants (latitude, longitude)
	map.setView(point.geometry.coordinates.toReversed(), 16);
}



// Example 11 - Autocenter

function autocenter() {
	
	// Check browser Geolocation support
	if (navigator.geolocation) {
		//alert("Starting geolocation service.");
		showToast("Starting geolocation service.");
		navigator.geolocation.getCurrentPosition(
			geolocationSuccessAutocenter, geolocationError, geolocationOptions
		);
	} else {
		//alert("Geolocation service not supported.");
		showToast("Geolocation service not supported.");
	}
}

function geolocationSuccessAutocenter(position) {
	point.geometry.coordinates = [position.coords.longitude, position.coords.latitude];

	point.properties.accuracy = position.coords.accuracy;
	point.properties.timestamp = position.timestamp;
	
	document.getElementById("coordinates-text").innerHTML = formatCoordinates();
	
	//console.log(JSON.stringify(point, null, 4));
	
	centerMap();
}

// Example 12 - Entities


function processCSV() {
	
	var url = "./files/random_5000.csv";
	
	// Pattern to send GET requests
	
	// 1. Create XHR instance
	
	var xhr = new XMLHttpRequest();
	
	// 2. Open and send request
	
	xhr.open("GET", url, true);
	
	// Parameter 1: HTTP verb
	// Parameter 2: URL
	// Parameter 3: true=asynchronous, false=synchronous
	
	xhr.overrideMimeType("text/csv");
	
	xhr.send();
	
	// 3. Get response
	
	xhr.onreadystatechange = function() { // Anonymous function
		if (xhr.readyState == 4 && xhr.status == 200) {
			// JS notation: && is the logical AND
			// If reach this point we have data
			
			// JS notation: var defines local variables
			
			var csvData = xhr.responseText;
			
			console.log(csvData);
			
			
			// Processing CSV data in JS
			
			var csvLines = csvData.split("\n");
			
			var features = []; // GeoJSON features
			
			// Bounding box
			
			var longitudeMin = 180.0;
			var latitudeMin = 90.0;
			var longitudeMax = -180.0;
			var latitudeMax = -90.0;
						
			for (var count = 0; count < csvLines.length; count++) {
				
				var record = csvLines[count].split(",");
				
				console.log(record);
				
				var longitude = parseFloat(record[1]);
				var latitude = parseFloat(record[2]);
				
				// push ~ append in Python
				
				features.push({
					"type": "Feature",
					"geometry": {
						"type": "Point",
						"coordinates": [longitude, latitude]
					},
					"properties": {
						"count": count,
						"id": record[0]
					}
				});
				
				if (longitude < longitudeMin) {
					longitudeMin = longitude;
				} else if (longitude >= longitudeMax) {
					longitudeMax = longitude;					
				}
				
				if (latitude < latitudeMin) {
					latitudeMin = latitude;
				} else if (latitude >= latitudeMax) {
					latitudeMax = latitude;					
				}
			}
			
			jsonObject = {
				"type": "FeatureCollection",
				"bbox": [longitudeMin, latitudeMin, longitudeMax, latitudeMax],
				"features": features
			}
			
			console.log(JSON.stringify(jsonObject, null, 4));
			
			showToast("Dataset loaded.");
		}
	}
}

// Leaflet

var leafletOptions = {
	radius: 20,
	color: "blue",
	fillOpacity: 0.8
};

var pointArray = [];
var polylineArray = [];
var polygonArray = [];

function drawPoints() {
	
	if (typeof jsonObject === "undefined") {
		showToast("Load data before drawing.");
		return;
	}
	
	// Create Leaflet point entities
	
	for (var count = 0; count < jsonObject.features.length; count++) {
	
		// Leaflet entity
		
		var pointID = L.circle(
			jsonObject.features[count].geometry.coordinates.toReversed(),
			leafletOptions
		);
		
		var popup = "";
		
		popup += "ID = " + jsonObject.features[count].properties.id + "<br>";
		popup += "Longitude = " + jsonObject.features[count].geometry.coordinates[0].toFixed(8) + "<br>";
		popup += "Latitude = " + jsonObject.features[count].geometry.coordinates[1].toFixed(8) + "<br>";
	
		pointID.bindPopup(popup);
		
		pointID.addTo(map); // Drawing the point
		
		pointArray.push(pointID);
	}
}

function clearFeatures() {
	// Remove points
	
	for (var count = 0; count < pointArray.length; count++) {
		map.removeLayer(pointArray[count]);
	}
	
	pointArray = [];
	
	// Remove polylines

	for (var count = 0; count < polylineArray.length; count++) {
		map.removeLayer(polylineArray[count]);
	}
	
	polylineArray = [];
	
	// Remove polygons

	for (var count = 0; count < polygonArray.length; count++) {
		map.removeLayer(polygonArray[count]);
	}
	
	polygonArray = [];
}


function drawPolylines() {

	if (typeof jsonObject === "undefined") {
		showToast("Load data before drawing.");
		return;
	}
	
	var [longitudeMin, latitudeMin, longitudeMax, latitudeMax] = jsonObject.bbox;
	
	var polyline = [
		[latitudeMin, longitudeMin],
		[latitudeMin, longitudeMax],
		[latitudeMax, longitudeMax],
		[latitudeMax, longitudeMin],
		[latitudeMin, longitudeMin]
	]; // Array
	
	var lineID = L.polyline(polyline, {weight: 5, color: "green"});
	
	var popup = "BBOX = " + JSON.stringify(polyline);
	
	lineID.bindPopup(popup);
	
	lineID.addTo(map); // Drawing polyline
	
	polylineArray.push(lineID);
}

function drawPolygons() {
	
	if (typeof jsonObject === "undefined") {
		showToast("Load data before drawing.");
		return;
	}

	var [longitudeMin, latitudeMin, longitudeMax, latitudeMax] = jsonObject.bbox;
	
	var polygon = [
		[latitudeMin, longitudeMin],
		[latitudeMin, longitudeMax],
		[latitudeMax, longitudeMax],
		[latitudeMax, longitudeMin],
		[latitudeMin, longitudeMin]
	]; // Array
	
	var polygonID = L.polygon(polygon, {weight: 5, color: "red"});
	
	var popup = "BBOX = " + JSON.stringify(polygon);
	
	polygonID.bindPopup(popup);
	
	polygonID.addTo(map); // Drawing polyline
	
	polygonArray.push(polygonID);
	
	
}

*/

