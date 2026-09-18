// Karte erstellen

const map = L.map('map').setView(
[64.5,26],
6
);


// OpenStreetMap hinzufügen

L.tileLayer(
'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
{

attribution:
'© OpenStreetMap contributors',

maxZoom:19

}

).addTo(map);




// GeoJSON laden

fetch('data/hiidenkirnut.geojson')

.then(response => response.json())

.then(data => {


L.geoJSON(data, {


onEachFeature:function(feature,layer){



layer.bindPopup(`

<h3>
${feature.properties.name}
</h3>


<p>
${feature.properties.description}
</p>


<strong>
${feature.properties.municipality},
${feature.properties.region}
</strong>


<br><br>


<img src="${feature.properties.image}"
width="200">


`);

}



}).addTo(map);


});
