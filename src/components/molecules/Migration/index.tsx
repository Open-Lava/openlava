import { graphql, useStaticQuery } from 'gatsby'
import React, { ReactElement, useEffect, useState } from 'react'
import Web3 from 'web3'
import {
  MigrationStatus,
  useMigrationStatus
} from '../../../providers/Migration'
import { useWeb3 } from '../../../providers/Web3'
import Alert from '../../atoms/Alert'
import Container from '../../atoms/Container'
import LockShares from './lockPoolShares'
import styles from './migration.module.css'

const query = graphql`
  query {
    content: allFile(filter: { relativePath: { eq: "migration.json" } }) {
      edges {
        node {
          childContentJson {
            liquidityProvider {
              migrationNotStarted {
                title
                text
              }
              migrationStarted {
                title
                text
              }
              poolSharesLocked {
                title
                text
              }
              deadlineMetThresholdMet {
                title
                text
              }
              migrationComplete {
                title
                text
              }
            }
          }
        }
      }
    }
  }
`

enum MigrationAction {
  NONE = 'none',
  START_MIGRATION = 'startMigration',
  COMPLETE_MIGRATION = 'completeMigration',
  CANCEL_MIGRATION = 'cancelMigration',
  LOCK_SHARES = 'lockShares',
  REMOVE_SHARES = 'removeShares',
  VIEW_V4_ASSET = 'viewV4Asset'
}

export default function Migration(): ReactElement {
  const [message, setMessage] = useState<string>()
  const [title, setTitle] = useState<string>()
  const [showMigration, setShowMigration] = useState<boolean>(false)
  const [action, setAction] = useState<MigrationAction>()
  const [sharesLocked, setSharesLocked] = useState<boolean>()
  const { accountId, block } = useWeb3()
  const {
    status,
    thresholdMet,
    deadlinePassed,
    poolShares,
    poolShareOwners,
    lockedSharesV3,
    deadline,
    canAddShares
  } = useMigrationStatus()
  // Get content
  const data = useStaticQuery(query)
  const content = data.content.edges[0].node.childContentJson

  function getLockedSharesMessage() {
    return `\n\nYou have ${poolShares} pool shares\n\nYou have locked ${Web3.utils.fromWei(
      lockedSharesV3 || '0'
    )} shares `
  }

  function getRemainingBlocksMessage() {
    return `\n\n${
      parseInt(deadline) - block
    } blocks left for migration deadline`
  }

  function getMessageAndActionForLiquidityProvider(
    status: string,
    thresholdMet: boolean,
    deadlinePassed: boolean,
    _poolShares: string
  ): { title: string; message: string; action: MigrationAction } {
    const poolShares = isNaN(Number(_poolShares)) ? 0 : Number(_poolShares)
    const liquidityProviderContent = content.liquidityProvider
    if (status === MigrationStatus.COMPLETED) {
      const { title, text } = liquidityProviderContent.migrationComplete
      return { title, message: text, action: MigrationAction.NONE }
    }
    if (status === MigrationStatus.NOT_STARTED) {
      const { title, text } = liquidityProviderContent.migrationNotStarted
      return { title, message: text, action: MigrationAction.NONE }
    }
    if (
      status !== MigrationStatus.NOT_STARTED &&
      !deadlinePassed &&
      poolShares > 0 &&
      canAddShares
    ) {
      const { title, text } = liquidityProviderContent.migrationStarted
      return {
        title,
        message: text + getLockedSharesMessage() + getRemainingBlocksMessage(),
        action: MigrationAction.LOCK_SHARES
      }
    }

    if (
      status !== MigrationStatus.NOT_STARTED &&
      !deadlinePassed &&
      poolShares <= 0
    ) {
      const { title, text } = liquidityProviderContent.poolSharesLocked
      return {
        title,
        message: text + getLockedSharesMessage() + getRemainingBlocksMessage(),
        action: MigrationAction.LOCK_SHARES
      }
    }

    if (
      status !== MigrationStatus.NOT_STARTED &&
      (deadlinePassed || thresholdMet) &&
      !canAddShares
    ) {
      const { title, text } = liquidityProviderContent.deadlineMetThresholdMet
      return {
        title,
        message: text + getLockedSharesMessage(),
        action: MigrationAction.NONE
      }
    }

    return {
      title: 'No migration information available',
      message: '',
      action: MigrationAction.NONE
    }
  }

  function setTitleMessageAction(
    title: string,
    message: string,
    action: MigrationAction
  ) {
    setTitle(title)
    setMessage(message)
    setAction(action)
  }

  function switchMessageAndAction(
    status: string,
    thresholdMet: boolean,
    deadlinePassed: boolean,
    poolShares: string
  ) {
    const { title, message, action } = getMessageAndActionForLiquidityProvider(
      status,
      thresholdMet,
      deadlinePassed,
      poolShares
    )
    return setTitleMessageAction(title, message, action)
  }

  useEffect(() => {
    if (!accountId) return
    const poolSharesNumber = isNaN(Number(poolShares)) ? 0 : Number(poolShares)
    if (poolSharesNumber > 0 || (lockedSharesV3 && lockedSharesV3 !== '0')) {
      setShowMigration(true)
    }
    // Check if user has already locked liquidity
    if (poolShareOwners) {
      for (let i = 0; i < poolShareOwners.length; i++) {
        if (accountId === poolShareOwners[i]) {
          setSharesLocked(true)
        }
      }
    }
    switchMessageAndAction(status, thresholdMet, deadlinePassed, poolShares)
  }, [
    accountId,
    poolShares,
    status,
    thresholdMet,
    deadlinePassed,
    sharesLocked,
    poolShareOwners,
    poolShares,
    lockedSharesV3
  ])

  return (
    <>
      {showMigration ? (
        <>
          <header className={styles.header}>V4 Migration Status</header>
          <Container className={styles.container}>
            <Alert
              title={title}
              text={message}
              state="info"
              className={styles.alert}
            />
            {action === MigrationAction.LOCK_SHARES && <LockShares />}
          </Container>
        </>
      ) : null}
    </>
  )
}