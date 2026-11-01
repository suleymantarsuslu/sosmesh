package com.sosmesh.android.core.platform

/** @internal Test-only hooks; not part of the public production API. */
internal data class RadioPlannerTestingHooks(
    val ignoreLowPowerConstraints: Boolean = false,
) {
    companion object {
        val NONE = RadioPlannerTestingHooks()
    }
}

/** @internal Test-only planner entry visible to JVM unit tests in this module. */
internal object AdaptiveRadioPlannerTesting {
    fun plan(
        input: RadioPlannerInput,
        testingHooks: RadioPlannerTestingHooks = RadioPlannerTestingHooks.NONE,
    ): RadioPlannerDecision = AdaptiveRadioPlanner.planInternal(input, testingHooks)
}
