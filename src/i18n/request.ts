import {notFound} from 'next/navigation';
import {getRequestConfig} from 'next-intl/server';
import {headers} from 'next/headers';

// Can be imported from a shared config
export const locales = ['en', 'ar'];
export const defaultLocale = 'en';

export default getRequestConfig(async ({requestLocale}) => {
  // This typically corresponds to the `[locale]` segment
  let locale = await requestLocale;

  // Ensure that the incoming locale is valid
  if (!locale || !locales.includes(locale)) {
    locale = defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default
  };
});