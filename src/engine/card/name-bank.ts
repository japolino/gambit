/**
 * Real names by naming tradition (docs/DESIGN.md 4.0, "names"): given names
 * by sex, surnames, and real small places. Data only; naming.ts draws from it.
 * Every entry is a name real people or real villages carry.
 */

export const TRADITION_IDS = ["english", "irish", "welsh", "norse", "german", "czech", "polish", "hungarian", "occitan", "basque", "spanish", "italian", "arabic", "persian", "yoruba", "japanese", "chinese"] as const;
export type NamingId = (typeof TRADITION_IDS)[number];

export interface Tradition {
  label: string;
  /** Words in a card's genre, premise or tone that point at this tradition. */
  cues: string[];
  female: string[];
  male: string[];
  surnames: string[];
  places: string[];
}

export const TRADITIONS: Record<NamingId, Tradition> = {
  english: {
    label: "English villages, old English names",
    cues: ["england", "english", "saxon", "anglo", "yorkshire", "london", "victorian", "regency", "tudor"],
    female: ["Edith", "Agnes", "Maud", "Alice", "Joan", "Margery", "Isabel", "Cecily", "Emma", "Matilda", "Rose", "Elsie", "Mildred", "Winifred", "Hilda", "Audrey"],
    male: ["Walter", "Hugh", "Roger", "Ralph", "Geoffrey", "Osric", "Edwin", "Alfred", "Godwin", "Wilfred", "Oswald", "Simon", "Giles", "Harold", "Robert", "Thomas"],
    surnames: ["Fletcher", "Thatcher", "Cooper", "Ashby", "Hale", "Marsh", "Webb", "Turner", "Barker", "Fowler", "Mercer", "Shepherd", "Brook", "Holt", "Wainwright", "Pickering"],
    places: ["Ashwell", "Burford", "Ludlow", "Wickham", "Shipton", "Oakham", "Kirkby", "Hexham", "Stowe", "Eyam", "Tetbury", "Cerne", "Ripley", "Hatfield", "Bampton", "Clun"],
  },
  irish: {
    label: "Irish",
    cues: ["ireland", "irish", "gaelic", "celtic"],
    female: ["Aoife", "Niamh", "Siobhan", "Orla", "Maeve", "Brigid", "Gráinne", "Úna", "Róisín", "Clodagh", "Eithne", "Deirdre", "Nuala", "Sinéad", "Muireann", "Ailbhe"],
    male: ["Cormac", "Diarmuid", "Fergus", "Niall", "Ruairí", "Colm", "Eoin", "Donal", "Lorcan", "Seamus", "Tadhg", "Ciarán", "Brendan", "Declan", "Padraig", "Conor"],
    surnames: ["Byrne", "Doyle", "Kavanagh", "Lynch", "Mulligan", "Brennan", "Fogarty", "Hennessy", "Keane", "Moran", "Nolan", "Quinlan", "Dunne", "Flynn", "Garvey", "Tierney"],
    places: ["Ballyvaughan", "Kilkee", "Dingle", "Clonakilty", "Athy", "Moate", "Kinvara", "Doolin", "Birr", "Ennistymon", "Leenane", "Tullamore", "Bantry", "Carlow", "Kells", "Cong"],
  },
  welsh: {
    label: "Welsh",
    cues: ["wales", "welsh", "cymru", "arthurian"],
    female: ["Angharad", "Bronwen", "Ceinwen", "Eluned", "Gwen", "Gwenllian", "Heledd", "Lowri", "Mared", "Nia", "Rhiannon", "Siân", "Tegwen", "Morfudd", "Eirlys", "Delyth"],
    male: ["Dafydd", "Emrys", "Gethin", "Gruffudd", "Huw", "Iolo", "Ifan", "Llywelyn", "Owain", "Rhodri", "Rhys", "Tudur", "Cadog", "Hywel", "Idris", "Madoc"],
    surnames: ["Pryce", "Pugh", "Bevan", "Gwynne", "Hopkin", "Lloyd", "Morgan", "Parry", "Powell", "Pritchard", "Vaughan", "Watkin", "Bowen", "Howell", "Jenkin", "Meredith"],
    places: ["Llanberis", "Beddgelert", "Dolgellau", "Machynlleth", "Bala", "Tregaron", "Rhayader", "Llandeilo", "Crickhowell", "Abergele", "Harlech", "Nefyn", "Corwen", "Talgarth", "Llanidloes", "Aberaeron"],
  },
  norse: {
    label: "Norse",
    cues: ["norse", "viking", "scandinav", "norway", "norwegian", "iceland", "fjord", "nordic", "sweden", "danish"],
    female: ["Astrid", "Sigrid", "Ingrid", "Gudrun", "Ragnhild", "Thora", "Solveig", "Hild", "Gunnhild", "Dagny", "Ragna", "Ylva", "Freydis", "Aslaug", "Signy", "Torunn"],
    male: ["Bjorn", "Leif", "Ulf", "Halvard", "Sigurd", "Gunnar", "Thorvald", "Ragnar", "Eyvind", "Ketil", "Arne", "Steinar", "Orm", "Hakon", "Einar", "Bard"],
    surnames: ["Olafsson", "Gunnarsson", "Haldorsen", "Berg", "Dahl", "Lund", "Strand", "Moen", "Haugen", "Rønning", "Bakke", "Nygaard", "Solberg", "Rustad", "Aas", "Holm"],
    places: ["Lom", "Vik", "Flåm", "Røros", "Hamar", "Molde", "Skien", "Odda", "Selje", "Dalen", "Vinje", "Lærdal", "Sogndal", "Levanger", "Tynset", "Ringebu"],
  },
  german: {
    label: "German",
    cues: ["german", "germany", "prussia", "bavaria", "black forest", "teutonic", "holy roman", "rhine"],
    female: ["Adelheid", "Gertrud", "Hedwig", "Hildegard", "Irmgard", "Kunigunde", "Liesel", "Mechthild", "Ottilie", "Ursula", "Walburga", "Gisela", "Elfriede", "Margarete", "Anneliese", "Brunhilde"],
    male: ["Albrecht", "Berthold", "Dietrich", "Eckhart", "Gottfried", "Hartmut", "Konrad", "Lothar", "Otto", "Rupert", "Siegfried", "Ulrich", "Volker", "Wolfram", "Hermann", "Gerhard"],
    surnames: ["Müller", "Schmidt", "Weber", "Becker", "Hoffmann", "Krüger", "Wagner", "Bauer", "Zimmermann", "Richter", "Brandt", "Vogel", "Hartmann", "Lange", "Kessler", "Huber"],
    places: ["Rothenburg", "Dinkelsbühl", "Quedlinburg", "Monschau", "Bacharach", "Wernigerode", "Goslar", "Meersburg", "Hameln", "Celle", "Eltville", "Mittenwald", "Oberwesel", "Tübingen", "Staufen", "Lindau"],
  },
  czech: {
    label: "Czech (Bohemian)",
    cues: ["bohemia", "bohemian", "czech", "moravia", "prague", "slavic"],
    female: ["Anežka", "Bohdana", "Dobromila", "Ludmila", "Marta", "Jitka", "Zdenka", "Věra", "Božena", "Milada", "Libuše", "Hana", "Jarmila", "Kateřina", "Dagmar", "Radka"],
    male: ["Bořivoj", "Vojtěch", "Přemysl", "Jaroslav", "Václav", "Ondřej", "Matěj", "Jiří", "Bohumil", "Zbyněk", "Radim", "Vavřinec", "Prokop", "Lukáš", "Ctibor", "Dalibor"],
    surnames: ["Novák", "Dvořák", "Svoboda", "Procházka", "Kučera", "Veselý", "Horák", "Němec", "Pokorný", "Mareš", "Hájek", "Kolář", "Kříž", "Beneš", "Šťastný", "Bartoš"],
    places: ["Hrušov", "Lhota", "Kouřim", "Telč", "Třeboň", "Mikulov", "Slavonice", "Kutná Hora", "Loket", "Beroun", "Písek", "Tábor", "Sázava", "Dačice", "Holašovice", "Kokořín"],
  },
  polish: {
    label: "Polish",
    cues: ["poland", "polish", "krakow", "kraków", "warsaw"],
    female: ["Agnieszka", "Bożena", "Dorota", "Halina", "Jadwiga", "Kinga", "Małgorzata", "Wanda", "Zofia", "Danuta", "Grażyna", "Krystyna", "Bogna", "Ewa", "Urszula", "Teresa"],
    male: ["Bogdan", "Bolesław", "Kazimierz", "Mieszko", "Stanisław", "Tadeusz", "Wojciech", "Zbigniew", "Jarosław", "Leszek", "Witold", "Mirosław", "Janusz", "Grzegorz", "Roman", "Ziemowit"],
    surnames: ["Kowalski", "Wiśniewski", "Nowicki", "Zając", "Wróbel", "Kaczmarek", "Mazur", "Krawczyk", "Pawlak", "Sikora", "Baran", "Duda", "Gajewski", "Kozłowski", "Wilk", "Sobczak"],
    places: ["Sandomierz", "Biecz", "Pułtusk", "Chełm", "Łowicz", "Tykocin", "Lanckorona", "Paczków", "Bochnia", "Żagań", "Sanok", "Krosno", "Wieliczka", "Nowy Targ", "Kazimierz Dolny", "Ząbkowice"],
  },
  hungarian: {
    label: "Hungarian",
    cues: ["hungary", "hungarian", "magyar", "carpathian", "puszta"],
    female: ["Erzsébet", "Ilona", "Katalin", "Piroska", "Réka", "Enikő", "Zsófia", "Ágnes", "Judit", "Csilla", "Emese", "Gizella", "Borbála", "Margit", "Tünde", "Hajnalka"],
    male: ["Árpád", "Bence", "Csaba", "Gábor", "Imre", "Károly", "Lajos", "Levente", "Miklós", "Tibor", "Zoltán", "Botond", "Ferenc", "Gyula", "Kálmán", "Attila"],
    surnames: ["Nagy", "Kovács", "Tóth", "Szabó", "Horváth", "Varga", "Kiss", "Molnár", "Németh", "Farkas", "Balogh", "Papp", "Takács", "Juhász", "Lakatos", "Fekete"],
    places: ["Hollókő", "Tokaj", "Eger", "Pécs", "Szentendre", "Tihany", "Kőszeg", "Sopron", "Makó", "Ócsa", "Tata", "Visegrád", "Baja", "Kalocsa", "Siklós", "Nagymaros"],
  },
  occitan: {
    label: "Occitan",
    cues: ["occitan", "occitania", "provence", "provençal", "languedoc", "troubadour", "cathar", "gascon", "gascony"],
    female: ["Azalais", "Beatritz", "Esclarmonda", "Ermessenda", "Garsenda", "Guilhelma", "Margarida", "Raimonda", "Felipa", "Alamanda", "Bruna", "Sicarda", "Tibors", "Joana", "Clara", "Mirèlha"],
    male: ["Raimon", "Bernat", "Guilhem", "Peire", "Arnaut", "Bertran", "Jaufre", "Folquet", "Uc", "Gaucelm", "Ramon", "Sicart", "Pons", "Esteve", "Joan", "Marcabru"],
    surnames: ["Fabre", "Bonnet", "Faure", "Mas", "Vidal", "Delmas", "Teissier", "Bousquet", "Castan", "Pujol", "Bonafous", "Calmels", "Combes", "Maurel", "Peyre", "Rouquette"],
    places: ["Conques", "Gordes", "Minerve", "Lagrasse", "Cordes", "Lautrec", "Najac", "Estaing", "Belcastel", "Rocamadour", "Puivert", "Montségur", "Peyrepertuse", "Gruissan", "Foix", "Ax"],
  },
  basque: {
    label: "Basque",
    cues: ["basque", "euskal", "euskadi", "pyrenees", "pyrenean"],
    female: ["Amaia", "Ainhoa", "Edurne", "Garazi", "Itziar", "Maite", "Nekane", "Miren", "Arantxa", "Oihana", "Leire", "Irati", "Uxue", "Josune", "Begoña", "Karmele"],
    male: ["Iñaki", "Aitor", "Gorka", "Unai", "Xabier", "Koldo", "Ander", "Eneko", "Iker", "Joseba", "Mikel", "Ibai", "Andoni", "Asier", "Jon", "Peio"],
    surnames: ["Etxeberria", "Goikoetxea", "Arrieta", "Zubizarreta", "Agirre", "Mendizabal", "Urrutia", "Elizondo", "Garmendia", "Ibarra", "Larrañaga", "Olano", "Zabala", "Iriarte", "Lizarraga", "Aranburu"],
    places: ["Lekeitio", "Elantxobe", "Hondarribia", "Zumaia", "Getaria", "Oñati", "Ezpeleta", "Sara", "Otsagabia", "Mundaka", "Bermeo", "Orio", "Segura", "Tolosa", "Lesaka", "Ziga"],
  },
  spanish: {
    label: "Castilian",
    cues: ["spain", "spanish", "castile", "castilian", "andalus", "andalusia", "conquistador", "reconquista"],
    female: ["Ximena", "Inés", "Leonor", "Mencía", "Beatriz", "Catalina", "Elvira", "Juana", "Lucía", "Mariana", "Pilar", "Rosario", "Constanza", "Sancha", "Urraca", "Aldonza"],
    male: ["Rodrigo", "Sancho", "Gonzalo", "Diego", "Íñigo", "Alonso", "Bermudo", "Fernán", "Martín", "Nuño", "Pelayo", "Ramiro", "Tomás", "Gil", "Lope", "Hernando"],
    surnames: ["García", "Fernández", "Ortega", "Navarro", "Morales", "Delgado", "Castro", "Vega", "Ruiz", "Herrera", "Mendoza", "Cabrera", "Salazar", "Medina", "Ibáñez", "Prieto"],
    places: ["Albarracín", "Frías", "Alquézar", "Ayllón", "Cudillero", "Mogarraz", "Olite", "Peñíscola", "Pedraza", "Sigüenza", "Trujillo", "Zafra", "Ujué", "Hita", "Béjar", "Sepúlveda"],
  },
  italian: {
    label: "Italian",
    cues: ["italy", "italian", "venice", "venetian", "florence", "florentine", "renaissance", "tuscan", "tuscany", "sicily", "sicilian", "mafia", "roman"],
    female: ["Giovanna", "Lucia", "Caterina", "Agnese", "Bianca", "Chiara", "Costanza", "Elena", "Ginevra", "Margherita", "Orsola", "Rosalia", "Vittoria", "Assunta", "Benedetta", "Filomena"],
    male: ["Bartolomeo", "Cosimo", "Gennaro", "Lorenzo", "Matteo", "Niccolò", "Ottavio", "Pietro", "Salvatore", "Tommaso", "Vincenzo", "Agostino", "Ercole", "Fabrizio", "Giacomo", "Sandro"],
    surnames: ["Russo", "Ferrari", "Esposito", "Bianchi", "Romano", "Colombo", "Ricci", "Marino", "Greco", "Bruno", "Gallo", "Conti", "Mancini", "Lombardi", "Moretti", "Barbieri"],
    places: ["Civita", "Bevagna", "Montefalco", "Spello", "Pienza", "Anghiari", "Bobbio", "Castelmezzano", "Sperlonga", "Atrani", "Scanno", "Orta", "Dozza", "Gubbio", "Norcia", "Vernazza"],
  },
  arabic: {
    label: "Arabic",
    cues: ["arab", "arabian", "sultan", "caliph", "caliphate", "bedouin", "djinn", "jinn", "oasis", "emir", "sahara"],
    female: ["Amira", "Fatima", "Layla", "Nadia", "Salma", "Yasmin", "Zaynab", "Huda", "Rania", "Samira", "Lubna", "Aisha", "Mariam", "Nour", "Hind", "Basma"],
    male: ["Tariq", "Yusuf", "Khalid", "Hassan", "Omar", "Karim", "Rashid", "Samir", "Faisal", "Hamza", "Jamal", "Nabil", "Ziyad", "Mansur", "Bilal", "Munir"],
    surnames: ["Haddad", "Khoury", "Nasser", "Saleh", "Mansour", "Hamdan", "Darwish", "Qasim", "Bakri", "Sabbagh", "Farouk", "Halabi", "Najjar", "Rifai", "Tamimi", "Zaidi"],
    places: ["Shibam", "Siwa", "Ghadames", "Tozeur", "Chefchaouen", "Taroudant", "Nizwa", "Bahla", "Ouarzazate", "Tinghir", "Douz", "Matmata", "Tarim", "Zabid", "Byblos", "Tyre"],
  },
  persian: {
    label: "Persian",
    cues: ["persia", "persian", "iran", "iranian", "zoroastrian", "shah", "isfahan"],
    female: ["Shirin", "Parisa", "Roya", "Golnar", "Mahsa", "Laleh", "Nasrin", "Farah", "Soraya", "Azadeh", "Nahid", "Mitra", "Pari", "Taraneh", "Yasaman", "Homa"],
    male: ["Dariush", "Kourosh", "Bahram", "Farhad", "Rostam", "Arash", "Babak", "Kaveh", "Siavash", "Mehrdad", "Jamshid", "Behrouz", "Payam", "Navid", "Omid", "Hooshang"],
    surnames: ["Tehrani", "Rahimi", "Karimi", "Moradi", "Shirazi", "Kermani", "Ahmadi", "Jafari", "Ghorbani", "Hashemi", "Sadeghi", "Abbasi", "Nikpour", "Yazdani", "Esfahani", "Mohammadi"],
    places: ["Abyaneh", "Masuleh", "Kashan", "Yazd", "Meybod", "Nain", "Kharanaq", "Zavareh", "Ardestan", "Bam", "Taft", "Mahan", "Tabas", "Natanz", "Toudeshk", "Kandovan"],
  },
  yoruba: {
    label: "Yoruba",
    cues: ["yoruba", "nigeria", "nigerian", "orisha", "west africa", "west african"],
    female: ["Adunni", "Folake", "Ayodele", "Bisola", "Funmilayo", "Morenike", "Titilayo", "Yetunde", "Omolara", "Kehinde", "Abeni", "Iyabo", "Bunmi", "Ronke", "Simisola", "Tolani"],
    male: ["Adewale", "Babatunde", "Femi", "Olumide", "Kayode", "Oluwaseun", "Tunde", "Ayodeji", "Bolaji", "Dapo", "Gbenga", "Kunle", "Segun", "Akin", "Lekan", "Wale"],
    surnames: ["Adeyemi", "Adebayo", "Ogunleye", "Balogun", "Oyelaran", "Akinola", "Bankole", "Fashola", "Ogundipe", "Olatunji", "Ajayi", "Adesina", "Ilori", "Oladipo", "Oyewole", "Babalola"],
    places: ["Ilesa", "Ogbomosho", "Iseyin", "Oyo", "Ede", "Ikirun", "Ilobu", "Igbeti", "Saki", "Iwo", "Ondo", "Akure", "Ilaro", "Owo", "Ila", "Ijebu-Ode"],
  },
  japanese: {
    label: "Japanese",
    cues: ["japan", "japanese", "edo", "samurai", "shogun", "ronin", "yokai", "kimono", "shinto", "tokyo", "kyoto", "onsen", "sengoku", "heian"],
    female: ["Haruko", "Chiyo", "Kiku", "Sayo", "Tomoe", "Yae", "Fumiko", "Natsu", "Shizuka", "Ume", "Kaede", "Misao", "Yoshiko", "Tsuru", "Akiko", "Sumire"],
    male: ["Jiro", "Saburo", "Kenji", "Tadashi", "Heihachi", "Kiyoshi", "Isamu", "Masaru", "Toru", "Shinsuke", "Genzo", "Tokichi", "Tetsuo", "Sakichi", "Rokuro", "Hachiro"],
    surnames: ["Tanaka", "Sakai", "Ishida", "Kuroda", "Mori", "Nomura", "Ogawa", "Hayashi", "Fujita", "Kondo", "Matsuda", "Okada", "Sugiyama", "Takeda", "Uchida", "Yoshida"],
    places: ["Tsumago", "Magome", "Ouchi", "Shirakawa", "Kurashiki", "Hagi", "Tsuwano", "Narai", "Kiso", "Yufuin", "Ine", "Hikone", "Mino", "Usuki", "Obama", "Kakunodate"],
  },
  chinese: {
    label: "Chinese",
    cues: ["china", "chinese", "wuxia", "xianxia", "cultivation", "cultivator", "jianghu", "dynasty", "qing", "ming dynasty", "tang dynasty"],
    female: ["Mei", "Lan", "Xiu", "Hui", "Ying", "Fang", "Jing", "Ling", "Yun", "Zhen", "Ping", "Xia", "Rong", "Juan", "Hua", "Lian"],
    male: ["Wei", "Jun", "Ming", "Bo", "Gang", "Hao", "Lei", "Qiang", "Tao", "Feng", "Jian", "Kang", "Liang", "Shan", "Zhi", "Yong"],
    surnames: ["Wang", "Li", "Zhang", "Liu", "Chen", "Yang", "Zhao", "Huang", "Zhou", "Wu", "Xu", "Sun", "Ma", "Zhu", "Hu", "Guo"],
    places: ["Pingyao", "Lijiang", "Hongcun", "Xidi", "Fenghuang", "Zhouzhuang", "Wuzhen", "Tongli", "Langzhong", "Dali", "Shaxi", "Xitang", "Huangyao", "Daxu", "Yangshuo", "Jiuhua"],
  },
};
