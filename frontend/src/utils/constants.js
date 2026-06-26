export const YEAR_OPTIONS = [
  { code: '01', name: 'Pre-preparatory 1st' },
  { code: '02', name: 'Pre-preparatory 2nd' },
  { code: '03', name: 'Pre-preparatory 3rd' },
  { code: '04', name: 'Beginner Class - I' },
  { code: '05', name: 'Beginner Class - II' },
  { code: '06', name: 'Beginner Class - III' },
  { code: '07', name: 'First Year' },
  { code: '08', name: 'Second Year' },
  { code: '09', name: 'Third Year' },
  { code: '10', name: 'Fourth Year' },
  { code: '11', name: 'Fifth Year' },
  { code: '12', name: 'Sixth Year' },
  { code: '13', name: 'Seventh Year' },
];

export const YEAR_NAMES = YEAR_OPTIONS.map(y => y.name);

export const SUBJECT_OPTIONS = [
  { code: '15', name: 'Painting' },
  { code: '16', name: 'Applied Art' },
  { code: '17', name: 'Graphic' },
  { code: '18', name: 'Sculpture' },
  { code: '19', name: 'Fabric Painting' },
  { code: '20', name: 'Vocal Music' },
  { code: '21', name: 'Tabla Badya' },
  { code: '22', name: 'Monipuri Nritya' },
  { code: '23', name: 'Kathak Nritya' },
  { code: '24', name: 'Guitar (Classical)' },
  { code: '25', name: 'Violin' },
];

export const SUBJECT_NAMES = SUBJECT_OPTIONS.map(s => s.name);

export const STATES = [
  'Assam', 'Arunachal Pradesh', 'Manipur', 'Meghalaya',
  'Mizoram', 'Nagaland', 'Sikkim', 'Tripura', 'West Bengal', 'Bihar', 'Other',
];

export const DISTRICTS_BY_STATE = {
  'Assam': [
    'Baksa','Barpeta','Biswanath','Bongaigaon','Cachar','Charaideo','Chirang',
    'Darrang','Dhemaji','Dhubri','Dibrugarh','Dima Hasao','Goalpara','Golaghat',
    'Hailakandi','Hojai','Jorhat','Kamrup','Kamrup Metropolitan','Karbi Anglong',
    'Karimganj','Kokrajhar','Lakhimpur','Majuli','Morigaon','Nagaon','Nalbari',
    'Sivasagar','Sonitpur','South Salmara-Mankachar','Tinsukia','Udalguri',
    'West Karbi Anglong',
  ],
  'Arunachal Pradesh': [
    'Anjaw','Changlang','Dibang Valley','East Kameng','East Siang','Kra Daadi',
    'Kurung Kumey','Lepa Rada','Lohit','Longding','Lower Dibang Valley',
    'Lower Siang','Lower Subansiri','Namsai','Pakke-Kessang','Papum Pare',
    'Shi Yomi','Siang','Tawang','Tirap','Upper Dibang Valley','Upper Siang',
    'Upper Subansiri','West Kameng','West Siang',
  ],
  'Manipur': [
    'Bishnupur','Chandel','Churachandpur','Imphal East','Imphal West',
    'Jiribam','Kakching','Kamjong','Kangpokpi','Noney','Pherzawl',
    'Senapati','Tamenglong','Tengnoupal','Thoubal','Ukhrul',
  ],
  'Meghalaya': [
    'East Garo Hills','East Jaintia Hills','East Khasi Hills','Eastern West Khasi Hills',
    'North Garo Hills','Ri Bhoi','South Garo Hills','South West Garo Hills',
    'South West Khasi Hills','West Garo Hills','West Jaintia Hills','West Khasi Hills',
  ],
  'Mizoram': [
    'Aizawl','Champhai','Hnahthial','Khawzawl','Kolasib','Lawngtlai',
    'Lunglei','Mamit','Saiha','Saitual','Serchhip',
  ],
  'Nagaland': [
    'Chumoukedima','Dimapur','Kiphire','Kohima','Longleng','Mokokchung',
    'Mon','Niuland','Noklak','Peren','Phek','Shamator','Tseminyu',
    'Tuensang','Wokha','Zunheboto',
  ],
  'Sikkim': ['East Sikkim','North Sikkim','Pakyong','Soreng','South Sikkim','West Sikkim'],
  'Tripura': [
    'Dhalai','Gomati','Khowai','North Tripura','Sepahijala',
    'South Tripura','Unakoti','West Tripura',
  ],
  'West Bengal': [
    'Alipurduar','Bankura','Birbhum','Cooch Behar','Dakshin Dinajpur',
    'Darjeeling','Hooghly','Howrah','Jalpaiguri','Jhargram','Kalimpong',
    'Kolkata','Malda','Murshidabad','Nadia','North 24 Parganas','Paschim Bardhaman',
    'Paschim Medinipur','Purba Bardhaman','Purba Medinipur','Purulia',
    'South 24 Parganas','Uttar Dinajpur',
  ],
  'Bihar': [
    'Araria','Arwal','Aurangabad','Banka','Begusarai','Bhagalpur','Bhojpur',
    'Buxar','Darbhanga','East Champaran','Gaya','Gopalganj','Jamui','Jehanabad',
    'Kaimur','Katihar','Khagaria','Kishanganj','Lakhisarai','Madhepura','Madhubani',
    'Munger','Muzaffarpur','Nalanda','Nawada','Patna','Purnia','Rohtas','Saharsa',
    'Samastipur','Saran','Sheikhpura','Sheohar','Sitamarhi','Siwan','Supaul',
    'Vaishali','West Champaran',
  ],
};
