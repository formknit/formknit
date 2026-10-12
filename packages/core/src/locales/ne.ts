import type { Messages } from '../messages'

/**
 * Nepali validation messages: `validate(schema, data, { messages: messagesNe })`.
 * Written without review by a professional translator; corrections are welcome.
 */
export const messagesNe: Messages = {
  required: (label) => `${label} आवश्यक छ`,
  mustTick: (label) => `कृपया "${label}" मा चिन्ह लगाउनुहोस्`,
  minLength: (label, n) => `${label} कम्तीमा ${n} अक्षरको हुनुपर्छ`,
  maxLength: (label, n) => `${label} बढीमा ${n} अक्षरको हुनुपर्छ`,
  min: (label, n) => `${label} कम्तीमा ${n} हुनुपर्छ`,
  max: (label, n) => `${label} बढीमा ${n} हुनुपर्छ`,
  pattern: (label) => `${label} को ढाँचा मिलेन`,
  email: (label) => `${label} मा मान्य इमेल ठेगाना राख्नुहोस्`,
  number: (label) => `${label} सङ्ख्या हुनुपर्छ`,
  date: (label) => `${label} मा मान्य मिति राख्नुहोस्`,
  time: (label) => `${label} मा मान्य समय राख्नुहोस्`,
  phone: (label) => `${label} मा मान्य फोन नम्बर राख्नुहोस्`,
  url: (label) => `${label} http:// वा https:// बाट सुरु हुने वेब ठेगाना हुनुपर्छ`,
  fileSize: (label, mb) => `${label} ${mb} MB वा सोभन्दा सानो हुनुपर्छ`,
  fileType: (label, accept) => `${label} यी मध्ये एक प्रकारको हुनुपर्छ: ${accept}`,
  signature: (label) => `${label} मा हस्ताक्षर गर्नुहोस्`,
  dateRange: (label) => `${label} मा सुरु र अन्त्य दुवै मिति चाहिन्छ`,
  dateOrder: (label) => `${label} को अन्त्य मिति सुरु मितिभन्दा अगाडि हुन सक्दैन`,
  address: (label) => `${label} मा कम्तीमा ठेगाना र सहर चाहिन्छ`,
  option: (label) => `${label} मा अमान्य विकल्प छ`,
  minItems: (label, n) => `${label} मा कम्तीमा ${n} वटा चाहिन्छ`,
  maxItems: (label, n) => `${label} मा बढीमा ${n} वटा मात्र हुन सक्छ`,
  calculation: (label, code) => `${label} गणना गर्न सकिएन (${code})`,
}
