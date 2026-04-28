const BASE_URL = window.location.origin
const DEFAULT_IMAGE = `${BASE_URL}/logobw.svg`
const DEFAULT_DESCRIPTION =
  'Interactive generative art, 3D experiments, and games built with Three.js and Vue.'

interface PageMeta {
  title: string
  description?: string
  image?: string
  url?: string
}

const setMeta = (selector: string, attribute: string, value: string): void => {
  let element = document.querySelector<HTMLMetaElement>(selector)
  if (!element) {
    element = document.createElement('meta')
    const [attributeName, attributeValue] = selector.replace('[', '').replace(']', '').split('=')
    element.setAttribute(attributeName.trim(), attributeValue.replace(/"/g, '').trim())
    document.head.appendChild(element)
  }
  element.setAttribute(attribute, value)
}

/**
 * Updates Open Graph and Twitter Card meta tags for the current page.
 * @param meta - Title, description, image URL and canonical URL for the page.
 */
export const updatePageMeta = (meta: PageMeta): void => {
  const {
    title,
    description = DEFAULT_DESCRIPTION,
    image = DEFAULT_IMAGE,
    url = window.location.href
  } = meta

  setMeta('meta[name="description"]', 'content', description)

  setMeta('meta[property="og:title"]', 'content', title)
  setMeta('meta[property="og:description"]', 'content', description)
  setMeta('meta[property="og:image"]', 'content', image)
  setMeta('meta[property="og:url"]', 'content', url)
  setMeta('meta[property="og:type"]', 'content', 'website')

  setMeta('meta[name="twitter:card"]', 'content', 'summary_large_image')
  setMeta('meta[name="twitter:title"]', 'content', title)
  setMeta('meta[name="twitter:description"]', 'content', description)
  setMeta('meta[name="twitter:image"]', 'content', image)
}
