import { useMDXComponents as getDocsMDXComponents } from 'nextra-theme-docs'
import {MDXComponents} from "nextra/dist/client/mdx-components";

const docsComponents = getDocsMDXComponents()

export const useMDXComponents = (components?: Readonly<MDXComponents>) => ({
  ...docsComponents,
  ...components
})
