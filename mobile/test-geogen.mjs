import { Country, State, City } from 'country-state-city';
import fs from 'fs';

const PRIORITY_CITIES_TR = ['İstanbul', 'Ankara', 'İzmir', 'Mersin', 'Antalya', 'Bursa', 'Adana', 'Gaziantep', 'Konya'];

const europeCodes = new Set(['AL','AD','AM','AT','BY','BE','BA','BG','CH','CY','CZ','DE','DK','EE','ES','FI','FR','GB','GE','GR','HU','HR','IE','IS','IT','LI','LT','LU','LV','MC','MD','MK','MT','ME','NL','NO','PL','PT','RO','RU','SM','RS','SK','SI','SE','TR','UA','VA']);

const countries = Country.getAllCountries();
const result = [];

let totalCitiesCount = 0;

for (const c of countries) {
  const statesData = [];

  if (c.isoCode === 'US') {
     const states = State.getStatesOfCountry('US');
     for (const s of states) {
       const cities = City.getCitiesOfState('US', s.isoCode).map(city => city.name);
       totalCitiesCount += cities.length;
       statesData.push({ id: s.isoCode, name: s.name, areas: cities });
     }
  } else if (c.isoCode === 'TR') {
     let states = State.getStatesOfCountry('TR');
     states.sort((a,b) => {
        let aName = a.name.replace(' Province', '');
        let bName = b.name.replace(' Province', '');
        if (aName === 'Istanbul') aName = 'İstanbul';
        if (aName === 'Izmir') aName = 'İzmir';
        if (bName === 'Istanbul') bName = 'İstanbul';
        if (bName === 'Izmir') bName = 'İzmir';

        const aIndex = PRIORITY_CITIES_TR.indexOf(aName);
        const bIndex = PRIORITY_CITIES_TR.indexOf(bName);
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;
        return aName.localeCompare(bName, 'tr');
     });
     
     for (const s of states) {
       let sName = s.name.replace(' Province', '');
       if (sName === 'Istanbul') sName = 'İstanbul';
       if (sName === 'Izmir') sName = 'İzmir';

       const cities = City.getCitiesOfState('TR', s.isoCode).map(city => city.name);
       totalCitiesCount += cities.length;
       statesData.push({ id: s.isoCode, name: sName, areas: cities });
     }
  } else if (europeCodes.has(c.isoCode)) {
     const states = State.getStatesOfCountry(c.isoCode);
     if (states.length > 0) {
       for (const s of states) {
         // Some countries have THOUSANDS of cities, breaking RN. We'll only take top 50 cities per state in Europe just in case,
         // or if it's small enough, take all. Let's try all.
         const cities = City.getCitiesOfState(c.isoCode, s.isoCode).map(ci => ci.name);
         totalCitiesCount += cities.length;
         statesData.push({ id: s.isoCode, name: s.name, areas: cities });
       }
     } else {
       const cities = City.getCitiesOfCountry(c.isoCode) || [];
       totalCitiesCount += cities.length;
       for (const ci of cities) {
         statesData.push({ id: ci.name, name: ci.name, areas: [] });
       }
     }
  } else {
     // Rest of the world: Country -> States/Cities as "City", no districts
     const states = State.getStatesOfCountry(c.isoCode);
     for (const s of states) {
         statesData.push({ id: s.isoCode, name: s.name, areas: [] });
     }
  }
  
  let cName = c.name;
  if (c.isoCode === 'TR') cName = 'Türkiye';

  result.push({
    code: c.isoCode,
    name: cName,
    cities: statesData
  });
}

result.sort((a,b) => {
  if (a.code === 'TR') return -1;
  if (b.code === 'TR') return 1;
  if (a.code === 'US') return -1;
  if (b.code === 'US') return 1;
  if (europeCodes.has(a.code) && !europeCodes.has(b.code)) return -1;
  if (!europeCodes.has(a.code) && europeCodes.has(b.code)) return 1;
  return a.name.localeCompare(b.name);
});

fs.writeFileSync('src/lib/geoData.json', JSON.stringify(result));
const stats = fs.statSync('src/lib/geoData.json');
console.log(`geoData.json created! Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB, Total specific areas: ${totalCitiesCount}`);
