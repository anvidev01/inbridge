/**
 * Photographs of the world InBridge serves, from Wikimedia Commons under
 * CC BY / CC BY-SA licences. They show public life in India, never InBridge's
 * users, team or product. Every one used on a page must be credited in the
 * footer (SiteFooter renders PHOTO_CREDITS for the photos a page passes in).
 */
export interface Photo {
    src: string;
    width: number;
    height: number;
    alt: string;
    title: string;
    creator: string;
    license: string;
    licenseUrl: string;
    page: string;
}

export const PHOTOS = {
    'bridge-crowd': {
        src: '/landing/bridge-crowd.jpg',
        width: 1800,
        height: 1200,
        alt: "People crossing the Howrah Bridge over the Hooghly river, Kolkata",
        title: "Howrah Bridge 02",
        creator: "Bernard Gagnon",
        license: "CC BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
        page: "https://commons.wikimedia.org/wiki/File:Howrah_Bridge_02.jpg",
    },
    'bridge-fog': {
        src: '/landing/bridge-fog.jpg',
        width: 1800,
        height: 1170,
        alt: "The Howrah Bridge in morning fog, Kolkata",
        title: "Howrah Bridge, Foggy",
        creator: "Dey.sandip",
        license: "CC BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
        page: "https://commons.wikimedia.org/wiki/File:Howrah_Bridge,_Foggy.jpg",
    },
    'farmer': {
        src: '/landing/farmer.jpg',
        width: 1800,
        height: 1595,
        alt: "A farmer standing in his cauliflower field at dusk",
        title: "An Indian farmer in his field of cauliflower. - Mapillary (FO99ZJVE9u 3t2U7NBWncg)",
        creator: "ganeshdhamodkar @ Mapillary.com",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
        page: "https://commons.wikimedia.org/wiki/File:An_Indian_farmer_in_his_field_of_cauliflower._-_Mapillary_(FO99ZJVE9u_3t2U7NBWncg).jpg",
    },
    'post-office': {
        src: '/landing/post-office.jpg',
        width: 1350,
        height: 1800,
        alt: "A man at the counter of an India Post office",
        title: "A man at an India Post Office",
        creator: "Saiphani02",
        license: "CC BY 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by/4.0",
        page: "https://commons.wikimedia.org/wiki/File:A_man_at_an_India_Post_Office.jpg",
    },
    'village-school': {
        src: '/landing/village-school.jpg',
        width: 1800,
        height: 1350,
        alt: "The gate of the government primary school in village Kaire, Punjab",
        title: "Govt primary school, Village Kaire, Punjab",
        creator: "Tulspal",
        license: "CC BY-SA 4.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/4.0",
        page: "https://commons.wikimedia.org/wiki/File:Govt_primary_school,_Village_Kaire,_Punjab.jpg",
    },
    'station': {
        src: '/landing/station.jpg',
        width: 1800,
        height: 1012,
        alt: "Passengers on a platform at Tiruchirappalli Junction railway station",
        title: "Tiruchirappalli Junction railway station (85059)",
        creator: "Manukrishnan80",
        license: "CC BY-SA 3.0",
        licenseUrl: "https://creativecommons.org/licenses/by-sa/3.0",
        page: "https://commons.wikimedia.org/wiki/File:Tiruchirappalli_Junction_railway_station_(85059).jpg",
    },
} satisfies Record<string, Photo>;

export type PhotoKey = keyof typeof PHOTOS;
