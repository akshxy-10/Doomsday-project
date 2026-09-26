async function geocode(placeName) {
  const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(placeName)}&limit=1`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.features || data.features.length === 0) {
    throw new Error("Location not found");
  }

  const coords = data.features[0].geometry.coordinates;
  return { lat: coords[1], lng: coords[0] };
}

async function getRoute(originLat, originLng, destLat, destLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson`;
  const response = await fetch(url);
  const data = await response.json();
  const route = data.routes[0];
  return {
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
    coordinates: route.geometry.coordinates
  };
}

async function getElevationGain(coordinates) {
  const locations = coordinates
    .filter((_, i) => i % 5 === 0)
    .map(c => ({ latitude: c[1], longitude: c[0] }));

  const response = await fetch("https://api.open-elevation.com/api/v1/lookup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ locations })
  });
  const data = await response.json();

  let totalGain = 0;
  for (let i = 1; i < data.results.length; i++) {
    const diff = data.results[i].elevation - data.results[i - 1].elevation;
    if (diff > 0) totalGain += diff;
  }
  return totalGain;
}

function calculateFuelCost(distanceKm, durationMin, elevationGainM, vehicle) {
  const baseFuelCost = (distanceKm / vehicle.mileageKmPerLitre) * vehicle.fuelPricePerLitre;
  const elevationPenalty = (elevationGainM / 100) * 0.05 * baseFuelCost;
  const totalCost = baseFuelCost + elevationPenalty;

  return {
    baseFuelCost: Math.round(baseFuelCost),
    elevationPenalty: Math.round(elevationPenalty),
    totalCost: Math.round(totalCost)
  };
}

const vehiclePresets = {
  hatchbackPetrol: { mileageKmPerLitre: 18, fuelPricePerLitre: 103 },
  sedanDiesel: { mileageKmPerLitre: 20, fuelPricePerLitre: 92 },
  suvPetrol: { mileageKmPerLitre: 12, fuelPricePerLitre: 103 }
};