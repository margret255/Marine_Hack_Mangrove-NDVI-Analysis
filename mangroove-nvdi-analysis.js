
// Title: Mangrove NDVI/EVI/NDMI Analysis in Kenya
// AOIs: Lamu Archipelago, Kilifi Creek, Tana Delta, Mtwapa Creek
// Mangrove masks: GMW v3 (2010, 2020)
// =======================================================

// --------------------
// AOIs (approximate boxes; refine if needed)
// --------------------
var lamu = ee.Geometry.Polygon([
  [[40.830, -2.350], [40.950, -2.350], [40.950, -2.200], [40.830, -2.200]]
]);
var kilifi = ee.Geometry.Polygon([
  [[39.820, -3.640], [39.880, -3.640], [39.880, -3.560], [39.820, -3.560]]
]);
var tana = ee.Geometry.Polygon([
  [[40.230, -2.730], [40.400, -2.730], [40.400, -2.540], [40.230, -2.540]]
]);
var mtwapa = ee.Geometry.Polygon([
  [[39.710, -3.980], [39.770, -3.980], [39.770, -3.920], [39.710, -3.920]]
]);

var sites = ee.FeatureCollection([
  ee.Feature(lamu,   {name: 'Lamu Archipelago'}),
  ee.Feature(kilifi, {name: 'Kilifi Creek'}),
  ee.Feature(tana,   {name: 'Tana Delta'}),
  ee.Feature(mtwapa, {name: 'Mtwapa Creek'})
]);

Map.centerObject(sites, 8);
Map.addLayer(sites, {color: 'yellow'}, 'AOI Sites');

// --------------------
// GMW extent vectors (public assets)
// --------------------
var gmw2010 = ee.FeatureCollection('projects/earthengine-legacy/assets/projects/sat-io/open-datasets/GMW/extent/gmw_v3_2010_vec');
var gmw2020 = ee.FeatureCollection('projects/earthengine-legacy/assets/projects/sat-io/open-datasets/GMW/extent/gmw_v3_2020_vec');

// --------------------
// Sentinel-2 cloud mask using SCL band (no QA60)
// --------------------
function maskS2_SCL(img) {
  var scl = img.select('SCL');
  var mask = scl.neq(3)   // cloud shadow
    .and(scl.neq(8))      // medium probability clouds
    .and(scl.neq(9))      // high probability clouds
    .and(scl.neq(10))     // thin cirrus
    .and(scl.neq(11));    // snow/ice
  return img.updateMask(mask);
}

// yearly median composite over AOI
function getS2Composite(year, aoi) {
  var start = ee.Date.fromYMD(year, 1, 1);
  var end   = ee.Date.fromYMD(year, 12, 31);
  var col = ee.ImageCollection('COPERNICUS/S2_SR')
    .filterBounds(aoi)
    .filterDate(start, end)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 50))
    .map(maskS2_SCL)
    .select(['B2','B4','B8','B11']); // BLUE, RED, NIR, SWIR1

 
  var isEmpty = col.size().eq(0);
  var img = ee.Image(ee.Algorithms.If(isEmpty, null, col.median().clip(aoi)));
  return img;
}

// Compute indices 
function indices(img) {
  var ndvi = img.normalizedDifference(['B8','B4']).rename('NDVI');
  var evi = img.expression(
    '2.5*((NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1))',
    {NIR: img.select('B8'), RED: img.select('B4'), BLUE: img.select('B2')}
  ).rename('EVI');
  var ndmi = img.normalizedDifference(['B8','B11']).rename('NDMI');
  return ndvi.addBands([evi, ndmi]);
}

//  mangrove mask (rasterized) for a given year and AOI
function mangroveMaskForYear(year, aoi) {
  var base = ee.Image().byte();
  var fc = ee.FeatureCollection(ee.Algorithms.If(
    ee.Number(year).lte(2015), gmw2010, gmw2020
  )).filterBounds(aoi);

  var mask = base.paint(fc, 1, 10).rename('mangrove').clip(aoi);
  return mask;
}

var years = ee.List([2018, 2019, 2020]);

// For each site & year, mean NDVI/EVI/NDMI over mangroves, plus pixel count
function perSiteYearStats(site) {
  var geom = ee.Feature(site).geometry();
  var name = ee.Feature(site).getString('name');

  var perYear = years.map(function(y) {
    y = ee.Number(y);
    var img = getS2Composite(y, geom);
    // If composite is null (no images), return an empty feature with nulls
    var statsFeature = ee.Feature(ee.Algorithms.If(img,
      (function() {
        var idx = indices(img);
        var mgMask = mangroveMaskForYear(y, geom);
        var idxMasked = idx.updateMask(mgMask);

        // Reduce means
        var stats = idxMasked.reduceRegion({
          reducer: ee.Reducer.mean(),
          geometry: geom,
          scale: 10,
          maxPixels: 1e9,
          bestEffort: true
        });

        // valid NDVI pixels
        var pix = idxMasked.select('NDVI').reduceRegion({
          reducer: ee.Reducer.count(),
          geometry: geom,
          scale: 10,
          maxPixels: 1e9,
          bestEffort: true
        }).get('NDVI');

        return ee.Feature(null, {
          site: name,
          year: y,
          NDVI: stats.get('NDVI'),
          EVI:  stats.get('EVI'),
          NDMI: stats.get('NDMI'),
          pixels: pix
        });
      })(),
      // else (no image)
      ee.Feature(null, {site: name, year: y, NDVI: null, EVI: null, NDMI: null, pixels: 0})
    ));
    return statsFeature;
  });

  return ee.FeatureCollection(perYear);
}

// Run across all sites
var resultsFC = ee.FeatureCollection(
  sites.toList(sites.size()).map(function(ft) {
    return perSiteYearStats(ee.Feature(ft));
  })
).flatten();

print('Per-AOI NDVI/EVI/NDMI (mean) by year', resultsFC.limit(50));

// -------------------------------------------------------
// Simple charts per site (NDVI/EVI/NDMI lines vs year)
// -------------------------------------------------------
function chartFor(siteName) {
  var fc = resultsFC.filter(ee.Filter.eq('site', siteName))
                    .sort('year');
  var chart = ui.Chart.feature.byFeature({
    features: fc,
    xProperty: 'year',
    yProperties: ['NDVI','EVI','NDMI']
  }).setOptions({
    title: siteName + ' — NDVI, EVI, NDMI',
    hAxis: {title: 'Year'},
    vAxis: {title: 'Mean Index (masked to mangroves)'},
    lineWidth: 2,
    pointSize: 4,
    series: {
      0: {targetAxisIndex: 0}, // NDVI
      1: {targetAxisIndex: 0}, // EVI
      2: {targetAxisIndex: 0}  // NDMI
    }
  });
  print(chart);
}

//  charts for each AOI
chartFor('Lamu Archipelago');
chartFor('Kilifi Creek');
chartFor('Tana Delta');
chartFor('Mtwapa Creek');

// -------------------------------------------------------
//  Map visualization for quick QA
// -------------------------------------------------------
var vizIdx = {min: 0.1, max: 0.7, palette: ['#d73027','#fdae61','#66bd63','#1a9850']};
var previewYear = 2020;
var previewSite = lamu;
var comp = getS2Composite(previewYear, previewSite);
if (comp) {
  var idxImg = indices(comp);
  var mgMask = mangroveMaskForYear(previewYear, previewSite);
  Map.addLayer(idxImg.select('NDVI').updateMask(mgMask), vizIdx, 'Preview NDVI ' + previewYear + ' (Lamu)');
}
