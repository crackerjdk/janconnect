export type LocationType = 'country' | 'state' | 'district' | 'block' | 'locality';

export interface SeedLocation {
  id: string;
  parent_id: string | null;
  name: string;
  type: LocationType;
  state_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

// Hierarchical geography starting with Uttarakhand, India.
// Designed so additional Indian states can be appended via data migrations without code changes.
export const SEED_LOCATIONS: SeedLocation[] = [
  { id: 'in-country', parent_id: null, name: 'India', type: 'country', state_code: null, latitude: 20.5937, longitude: 78.9629 },
  { id: 'uk-state', parent_id: 'in-country', name: 'Uttarakhand', type: 'state', state_code: 'UK', latitude: 30.0668, longitude: 79.0193 },

  // 13 Districts of Uttarakhand
  { id: 'uk-dehradun', parent_id: 'uk-state', name: 'Dehradun', type: 'district', state_code: 'UK', latitude: 30.3165, longitude: 78.0322 },
  { id: 'uk-haridwar', parent_id: 'uk-state', name: 'Haridwar', type: 'district', state_code: 'UK', latitude: 29.9457, longitude: 78.1642 },
  { id: 'uk-nainital', parent_id: 'uk-state', name: 'Nainital', type: 'district', state_code: 'UK', latitude: 29.3919, longitude: 79.4542 },
  { id: 'uk-usnagar', parent_id: 'uk-state', name: 'Udham Singh Nagar', type: 'district', state_code: 'UK', latitude: 28.961, longitude: 79.515 },
  { id: 'uk-almora', parent_id: 'uk-state', name: 'Almora', type: 'district', state_code: 'UK', latitude: 29.5892, longitude: 79.6467 },
  { id: 'uk-pauri', parent_id: 'uk-state', name: 'Pauri Garhwal', type: 'district', state_code: 'UK', latitude: 30.1469, longitude: 78.7808 },
  { id: 'uk-tehri', parent_id: 'uk-state', name: 'Tehri Garhwal', type: 'district', state_code: 'UK', latitude: 30.3753, longitude: 78.4337 },
  { id: 'uk-chamoli', parent_id: 'uk-state', name: 'Chamoli', type: 'district', state_code: 'UK', latitude: 30.4067, longitude: 79.3212 },
  { id: 'uk-pithoragarh', parent_id: 'uk-state', name: 'Pithoragarh', type: 'district', state_code: 'UK', latitude: 29.5829, longitude: 80.2182 },
  { id: 'uk-bageshwar', parent_id: 'uk-state', name: 'Bageshwar', type: 'district', state_code: 'UK', latitude: 29.8362, longitude: 79.7714 },
  { id: 'uk-champawat', parent_id: 'uk-state', name: 'Champawat', type: 'district', state_code: 'UK', latitude: 29.3361, longitude: 80.091 },
  { id: 'uk-rudraprayag', parent_id: 'uk-state', name: 'Rudraprayag', type: 'district', state_code: 'UK', latitude: 30.2844, longitude: 78.9811 },
  { id: 'uk-uttarkashi', parent_id: 'uk-state', name: 'Uttarkashi', type: 'district', state_code: 'UK', latitude: 30.7268, longitude: 78.4354 },

  // Blocks / Municipalities
  { id: 'uk-dehradun-raipur', parent_id: 'uk-dehradun', name: 'Raipur / Dehradun Municipal', type: 'block', state_code: 'UK', latitude: 30.325, longitude: 78.08 },
  { id: 'uk-dehradun-vikasnagar', parent_id: 'uk-dehradun', name: 'Vikasnagar', type: 'block', state_code: 'UK', latitude: 30.469, longitude: 77.772 },
  { id: 'uk-dehradun-rishikesh', parent_id: 'uk-dehradun', name: 'Rishikesh Municipal', type: 'block', state_code: 'UK', latitude: 30.0869, longitude: 78.2676 },
  { id: 'uk-dehradun-mussoorie', parent_id: 'uk-dehradun', name: 'Mussoorie Municipal', type: 'block', state_code: 'UK', latitude: 30.4598, longitude: 78.0644 },

  { id: 'uk-haridwar-city', parent_id: 'uk-haridwar', name: 'Haridwar Municipal', type: 'block', state_code: 'UK', latitude: 29.9457, longitude: 78.1642 },
  { id: 'uk-haridwar-roorkee', parent_id: 'uk-haridwar', name: 'Roorkee', type: 'block', state_code: 'UK', latitude: 29.8543, longitude: 77.888 },
  { id: 'uk-haridwar-laksar', parent_id: 'uk-haridwar', name: 'Laksar', type: 'block', state_code: 'UK', latitude: 29.756, longitude: 78.04 },

  { id: 'uk-nainital-haldwani', parent_id: 'uk-nainital', name: 'Haldwani Municipal', type: 'block', state_code: 'UK', latitude: 29.2183, longitude: 79.513 },
  { id: 'uk-nainital-bhimtal', parent_id: 'uk-nainital', name: 'Bhimtal / Nainital', type: 'block', state_code: 'UK', latitude: 29.3461, longitude: 79.5519 },
  { id: 'uk-nainital-ramnagar', parent_id: 'uk-nainital', name: 'Ramnagar', type: 'block', state_code: 'UK', latitude: 29.3948, longitude: 79.1265 },

  { id: 'uk-usnagar-rudrapur', parent_id: 'uk-usnagar', name: 'Rudrapur Municipal', type: 'block', state_code: 'UK', latitude: 28.9875, longitude: 79.4141 },
  { id: 'uk-usnagar-kashipur', parent_id: 'uk-usnagar', name: 'Kashipur', type: 'block', state_code: 'UK', latitude: 29.2104, longitude: 78.9619 },

  { id: 'uk-almora-hawalbagh', parent_id: 'uk-almora', name: 'Hawalbagh / Almora', type: 'block', state_code: 'UK', latitude: 29.5971, longitude: 79.6591 },
  { id: 'uk-almora-ranikhet', parent_id: 'uk-almora', name: 'Ranikhet / Tarikhet', type: 'block', state_code: 'UK', latitude: 29.6434, longitude: 79.4322 },

  { id: 'uk-pauri-srinagar', parent_id: 'uk-pauri', name: 'Srinagar / Khirsu', type: 'block', state_code: 'UK', latitude: 30.2224, longitude: 78.7834 },
  { id: 'uk-pauri-kotdwar', parent_id: 'uk-pauri', name: 'Kotdwar Municipal', type: 'block', state_code: 'UK', latitude: 29.7464, longitude: 78.523 },

  { id: 'uk-tehri-chamba', parent_id: 'uk-tehri', name: 'Chamba / New Tehri', type: 'block', state_code: 'UK', latitude: 30.3435, longitude: 78.3935 },
  { id: 'uk-chamoli-gopeshwar', parent_id: 'uk-chamoli', name: 'Dasholi / Gopeshwar', type: 'block', state_code: 'UK', latitude: 30.4093, longitude: 79.3198 },
  { id: 'uk-pithoragarh-munakot', parent_id: 'uk-pithoragarh', name: 'Pithoragarh / Munakot', type: 'block', state_code: 'UK', latitude: 29.5829, longitude: 80.2182 },
  { id: 'uk-bageshwar-block', parent_id: 'uk-bageshwar', name: 'Bageshwar Block', type: 'block', state_code: 'UK', latitude: 29.8362, longitude: 79.7714 },
  { id: 'uk-champawat-lohaghat', parent_id: 'uk-champawat', name: 'Lohaghat / Champawat', type: 'block', state_code: 'UK', latitude: 29.4036, longitude: 80.0887 },
  { id: 'uk-rudraprayag-augm', parent_id: 'uk-rudraprayag', name: 'Augustmuni / Rudraprayag', type: 'block', state_code: 'UK', latitude: 30.394, longitude: 79.027 },
  { id: 'uk-uttarkashi-bhatwari', parent_id: 'uk-uttarkashi', name: 'Bhatwari / Uttarkashi', type: 'block', state_code: 'UK', latitude: 30.7268, longitude: 78.4354 },

  // Localities / Wards / Villages
  { id: 'uk-dehradun-raipur-rajpur', parent_id: 'uk-dehradun-raipur', name: 'Rajpur Road Ward', type: 'locality', state_code: 'UK', latitude: 30.365, longitude: 78.07 },
  { id: 'uk-dehradun-raipur-dalanwala', parent_id: 'uk-dehradun-raipur', name: 'Dalanwala', type: 'locality', state_code: 'UK', latitude: 30.32, longitude: 78.055 },
  { id: 'uk-dehradun-raipur-sahastradhara', parent_id: 'uk-dehradun-raipur', name: 'Sahastradhara Crossing', type: 'locality', state_code: 'UK', latitude: 30.34, longitude: 78.09 },
  { id: 'uk-dehradun-vikasnagar-town', parent_id: 'uk-dehradun-vikasnagar', name: 'Vikasnagar Market Ward', type: 'locality', state_code: 'UK', latitude: 30.469, longitude: 77.772 },
  { id: 'uk-dehradun-rishikesh-triveni', parent_id: 'uk-dehradun-rishikesh', name: 'Triveni Ghat / Tilak Road', type: 'locality', state_code: 'UK', latitude: 30.103, longitude: 78.295 },
  { id: 'uk-dehradun-mussoorie-library', parent_id: 'uk-dehradun-mussoorie', name: 'Library Chowk / Landour', type: 'locality', state_code: 'UK', latitude: 30.459, longitude: 78.064 },

  { id: 'uk-haridwar-city-jwalapur', parent_id: 'uk-haridwar-city', name: 'Jwalapur', type: 'locality', state_code: 'UK', latitude: 29.922, longitude: 78.105 },
  { id: 'uk-haridwar-city-kankhal', parent_id: 'uk-haridwar-city', name: 'Kankhal', type: 'locality', state_code: 'UK', latitude: 29.925, longitude: 78.148 },
  { id: 'uk-haridwar-roorkee-civil', parent_id: 'uk-haridwar-roorkee', name: 'Civil Lines Roorkee', type: 'locality', state_code: 'UK', latitude: 29.865, longitude: 77.896 },
  { id: 'uk-haridwar-laksar-main', parent_id: 'uk-haridwar-laksar', name: 'Laksar Bazaar', type: 'locality', state_code: 'UK', latitude: 29.756, longitude: 78.04 },

  { id: 'uk-nainital-haldwani-kathgodam', parent_id: 'uk-nainital-haldwani', name: 'Kathgodam', type: 'locality', state_code: 'UK', latitude: 29.266, longitude: 79.547 },
  { id: 'uk-nainital-haldwani-mukhani', parent_id: 'uk-nainital-haldwani', name: 'Mukhani / Kaladhungi Road', type: 'locality', state_code: 'UK', latitude: 29.222, longitude: 79.501 },
  { id: 'uk-nainital-bhimtal-tallital', parent_id: 'uk-nainital-bhimtal', name: 'Tallital / Mallital', type: 'locality', state_code: 'UK', latitude: 29.38, longitude: 79.46 },
  { id: 'uk-nainital-ramnagar-town', parent_id: 'uk-nainital-ramnagar', name: 'Ramnagar Town', type: 'locality', state_code: 'UK', latitude: 29.3948, longitude: 79.1265 },

  { id: 'uk-usnagar-rudrapur-awaas', parent_id: 'uk-usnagar-rudrapur', name: 'Awas Vikas Rudrapur', type: 'locality', state_code: 'UK', latitude: 28.985, longitude: 79.405 },
  { id: 'uk-usnagar-kashipur-main', parent_id: 'uk-usnagar-kashipur', name: 'Kashipur Ward', type: 'locality', state_code: 'UK', latitude: 29.21, longitude: 78.96 },

  { id: 'uk-almora-hawalbagh-chowk', parent_id: 'uk-almora-hawalbagh', name: 'Mall Road Almora', type: 'locality', state_code: 'UK', latitude: 29.597, longitude: 79.659 },
  { id: 'uk-almora-ranikhet-sadar', parent_id: 'uk-almora-ranikhet', name: 'Sadar Bazaar Ranikhet', type: 'locality', state_code: 'UK', latitude: 29.643, longitude: 79.432 },

  { id: 'uk-pauri-srinagar-town', parent_id: 'uk-pauri-srinagar', name: 'Srinagar Garhwal Ward', type: 'locality', state_code: 'UK', latitude: 30.222, longitude: 78.783 },
  { id: 'uk-pauri-kotdwar-town', parent_id: 'uk-pauri-kotdwar', name: 'Kotdwar Town', type: 'locality', state_code: 'UK', latitude: 29.746, longitude: 78.523 },

  { id: 'uk-tehri-chamba-newtehri', parent_id: 'uk-tehri-chamba', name: 'New Tehri Baurari', type: 'locality', state_code: 'UK', latitude: 30.375, longitude: 78.433 },
  { id: 'uk-chamoli-gopeshwar-town', parent_id: 'uk-chamoli-gopeshwar', name: 'Gopeshwar Town', type: 'locality', state_code: 'UK', latitude: 30.409, longitude: 79.319 },
  { id: 'uk-pithoragarh-town', parent_id: 'uk-pithoragarh-munakot', name: 'Pithoragarh Town', type: 'locality', state_code: 'UK', latitude: 29.582, longitude: 80.218 },
  { id: 'uk-bageshwar-town', parent_id: 'uk-bageshwar-block', name: 'Bageshwar Town', type: 'locality', state_code: 'UK', latitude: 29.836, longitude: 79.771 },
  { id: 'uk-champawat-town', parent_id: 'uk-champawat-lohaghat', name: 'Lohaghat Town', type: 'locality', state_code: 'UK', latitude: 29.403, longitude: 80.088 },
  { id: 'uk-rudraprayag-town', parent_id: 'uk-rudraprayag-augm', name: 'Rudraprayag Main', type: 'locality', state_code: 'UK', latitude: 30.284, longitude: 78.981 },
  { id: 'uk-uttarkashi-town', parent_id: 'uk-uttarkashi-bhatwari', name: 'Uttarkashi Town', type: 'locality', state_code: 'UK', latitude: 30.726, longitude: 78.435 },
];
