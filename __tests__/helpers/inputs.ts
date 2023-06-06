const INPUT_KEY = `INPUT_`

/** For `core.getInput()` */
export const setInputEnv = (input: string, value: string): void => {
  process.env[`${INPUT_KEY}${input}`.toUpperCase()] = value
}

export const unsetInputEnv = (input: string): void => {
  delete process.env[`${INPUT_KEY}${input}`.toUpperCase()]
}

export const getInputEnv = (input: string): string | undefined => {
  return process.env[`${INPUT_KEY}${input}`.toUpperCase()]
}
