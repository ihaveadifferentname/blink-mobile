import React, { useCallback, useEffect, useLayoutEffect, useState } from "react"

import { useIsFocused, useNavigation } from "@react-navigation/native"
import { NativeStackNavigationProp } from "@react-navigation/native-stack"
import { makeStyles, Text, useTheme } from "@rn-vui/themed"

import { GaloyPrimaryButton } from "@app/components/atomic/galoy-primary-button"
import { GaloySecondaryButton } from "@app/components/atomic/galoy-secondary-button"
import { headerCloseControlOptions } from "@app/components/header-close-control"
import { IconHero } from "@app/components/icon-hero"
import { useTwoFactorEnforcement } from "@app/custodial/providers/two-factor-enforcement"
import { useEmailReverification } from "@app/hooks/use-email-reverification"
import { useI18nContext } from "@app/i18n/i18n-react"
import { RootStackParamList } from "@app/navigation/stack-param-lists"
import { useHardwareBackGuard } from "@app/screens/account-migration/hooks/use-hardware-back-guard"
import { TwoFactorMethod } from "@app/types/two-factor-enforcement"
import { logTwoFactorSetupStarted } from "@app/utils/analytics"

import { StepLayout } from "./step-layout"

export const TwoFactorSetupScreen: React.FC = () => {
  const { LL } = useI18nContext()
  const styles = useStyles()
  const {
    theme: { colors },
  } = useTheme()
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, "twoFactorSetup">>()
  const isFocused = useIsFocused()
  const { unmetTier, hasTwoFactor, missingMethod, unverifiedEmail, registerDismissal } =
    useTwoFactorEnforcement()
  const { promptReverification } = useEmailReverification()
  /** The tier this screen was opened for: what it reports, and what leaving it unfinished
   *  is charged to, even if the balance moves while it is open. */
  const [promptTier] = useState(unmetTier)

  const isEmailMissing = missingMethod === TwoFactorMethod.Email
  const primaryTitle = isEmailMissing
    ? LL.TwoFactorEnforcement.addEmail()
    : LL.TwoFactorEnforcement.addPhoneNumber()

  /** Leaving without a factor is a dismissal for the tiers that prompt at session start;
   *  the provider ignores it below them. The hardware back leaves the same way, and the
   *  swipe is off for this route, so no exit skips the count. */
  const handleClose = useCallback(() => {
    registerDismissal(promptTier)
    navigation.goBack()
  }, [registerDismissal, promptTier, navigation])

  useHardwareBackGuard(handleClose)

  useLayoutEffect(() => {
    navigation.setOptions(headerCloseControlOptions({ onPress: handleClose }))
  }, [navigation, handleClose])

  /** The flows this screen hands off to return into it. Once the account holds two
   *  factors there is nothing left to offer, so it steps aside rather than asking for a
   *  factor the account just added. Only while focused: a screen lower in the stack
   *  going back would pop whichever screen is on top instead of itself. */
  const isSetupComplete = isFocused && hasTwoFactor
  useEffect(() => {
    if (isSetupComplete) navigation.goBack()
  }, [isSetupComplete, navigation])

  const handleAddMissingMethod = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: missingMethod })
    if (unverifiedEmail) {
      promptReverification(unverifiedEmail)
      return
    }
    if (isEmailMissing) {
      navigation.navigate("emailRegistrationInitiate")
      return
    }
    navigation.navigate("phoneRegistrationInitiate")
  }, [
    navigation,
    promptTier,
    missingMethod,
    unverifiedEmail,
    promptReverification,
    isEmailMissing,
  ])

  const handleSetAuthenticator = useCallback(() => {
    logTwoFactorSetupStarted({ tier: promptTier, method: TwoFactorMethod.Authenticator })
    navigation.navigate("totpRegistrationInitiate")
  }, [navigation, promptTier])

  return (
    <StepLayout
      footer={
        <>
          <GaloyPrimaryButton title={primaryTitle} onPress={handleAddMissingMethod} />
          <GaloySecondaryButton
            title={LL.TwoFactorEnforcement.setAuthenticator()}
            onPress={handleSetAuthenticator}
          />
        </>
      }
    >
      <IconHero
        icon="lock-closed"
        iconColor={colors._green}
        title={LL.TwoFactorEnforcement.setupTitle()}
        subtitle={
          <Text type="p3" style={styles.description}>
            {LL.TwoFactorEnforcement.setupDescription()}
          </Text>
        }
      />
    </StepLayout>
  )
}

const useStyles = makeStyles(({ colors }) => ({
  description: {
    color: colors.grey1,
    textAlign: "center",
  },
}))
