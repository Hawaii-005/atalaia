// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Bruno Rocha
package io.github.hawaii005.atalaia

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class FatiadorPackage : ReactPackage {
  override fun createNativeModules(contexto: ReactApplicationContext): List<NativeModule> =
      listOf(FatiadorModule(contexto))

  override fun createViewManagers(contexto: ReactApplicationContext): List<ViewManager<*, *>> =
      emptyList()
}
