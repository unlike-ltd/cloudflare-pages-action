import {getInput, setOutput, summary} from '@unlike/github-actions-core'
import {$} from 'execa'

import type {PagesDeployment} from './types.js'
import {
  ACTION_INPUT_ACCOUNT_ID,
  ACTION_INPUT_API_TOKEN,
  ACTION_INPUT_DIRECTORY,
  ACTION_INPUT_PROJECT_NAME,
  CLOUDFLARE_ACCOUNT_ID,
  CLOUDFLARE_API_TOKEN
} from '../constants.js'
import {getCloudflareApiEndpoint} from './api/endpoints.js'
import {fetchResult} from './api/fetch-result.js'

const ERROR_KEY = `Create Deployment:`

const getDeployments = async (): Promise<Array<PagesDeployment>> => {
  const url = getCloudflareApiEndpoint('deployments')

  const result = await fetchResult<Array<PagesDeployment>>(url)

  return result
}

export const getDeploymentAlias = (deployment: PagesDeployment): string => {
  return deployment.aliases && deployment.aliases.length > 0
    ? deployment.aliases[0]
    : deployment.url
}

export const createDeployment = async () => {
  const accountId = getInput(ACTION_INPUT_ACCOUNT_ID, {
    required: true
  })
  const projectName = getInput(ACTION_INPUT_PROJECT_NAME, {
    required: true
  })
  const directory = getInput(ACTION_INPUT_DIRECTORY, {
    required: true
  })
  const apiToken = getInput(ACTION_INPUT_API_TOKEN, {
    required: true
  })

  /**
   * Depending on what event triggers the action.
   * The GITHUB_HEAD_REF may be undefined so we fallback to GITHUB_REF_NAME.
   * It checks `branch` against the `project.production_branch` if `branch`
   * is not undefined.
   * https://github.com/cloudflare/workers-sdk/blob/a728876e607635081cd1ed00d06b7af86e7efd49/packages/wrangler/src/api/pages/deploy.tsx#L133-L136
   */
  const branch = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME
  const commitHash = process.env.GITHUB_SHA

  process.env[CLOUDFLARE_API_TOKEN] = apiToken
  process.env[CLOUDFLARE_ACCOUNT_ID] = accountId

  if (branch === undefined) {
    throw new Error(`${ERROR_KEY} branch is undefined`)
  }

  if (commitHash === undefined) {
    throw new Error(`${ERROR_KEY} commitHash is undefined`)
  }

  try {
    /**
     * Tried to use wrangler.unstable_pages.deploy. But wrangler is 8mb+ and the bundler is unable to tree shake it.
     */
    await $`npx wrangler@3.1.1 pages deploy ${directory} --project-name=${projectName} --branch=${branch} --commit-dirty=true --commit-hash=${commitHash}`

    // get deployment
    const deployments = await getDeployments()

    /**
     * Get the latest deployment by commitHash.
     */
    const deployment = deployments.find(
      deployment =>
        deployment.deployment_trigger.metadata.commit_hash === commitHash
    )

    if (deployment === undefined) {
      throw new Error(
        `${ERROR_KEY} could not find deployment with commitHash: ${commitHash}`
      )
    }

    setOutput('id', deployment.id)
    setOutput('url', deployment.url)
    setOutput('environment', deployment.environment)

    const alias: string = getDeploymentAlias(deployment)
    setOutput('alias', alias)

    const deployStage = deployment.stages.find(stage => stage.name === 'deploy')

    const repo = process.env.GITHUB_REPOSITORY || ''

    await summary.addHeading('Cloudflare Pages Deployment').write()
    await summary.addBreak().write()
    await summary
      .addTable([
        [
          {
            data: 'Name',
            header: true
          },
          {
            data: 'Result',
            header: true
          }
        ],
        ['Environment:', deployment.environment],
        [
          'Branch:',
          `<a href='https://github.com/${repo}/tree/${deployment.deployment_trigger.metadata.branch}'><code>${deployment.deployment_trigger.metadata.branch}</code></a>`
        ],
        [
          'Commit Hash:',
          `<a href='https://github.com/${repo}/commit/${deployment.deployment_trigger.metadata.commit_hash}><code>${deployment.deployment_trigger.metadata.commit_hash}</code></a>`
        ],
        [
          'Commit Message:',
          deployment.deployment_trigger.metadata.commit_message
        ],
        [
          'Status:',
          `<strong>${deployStage?.status.toUpperCase() || `UNKNOWN`}</strong>`
        ],
        ['Preview URL:', `<a href='${deployment.url}'>${deployment.url}</a>`],
        ['Branch Preview URL:', `<a href='${alias}'>${alias}</a>`]
      ])
      .write()

    return deployment
  } catch (error) {
    if (error instanceof Error) {
      throw error
    }
    if (
      error &&
      typeof error === 'object' &&
      'stderr' in error &&
      typeof error.stderr === 'string'
    ) {
      throw new Error(error.stderr)
    }
    throw new Error(`${ERROR_KEY} unknown error`)
  }
}
