//
//  KowalskiEnvironment.swift
//  KowalskiUtils
//
//  Created by Kamaal M Farah on 3/28/26.
//

import Foundation

public enum KowalskiEnvironment {
    public static let isUiTesting = ProcessInfo.processInfo[.isUiTesing] == "1"
    public static let isUiTestingFailCreateEntry = ProcessInfo.processInfo[.isUiTestingFailCreateEntry] == "1"
}

public enum KowalskiEnvironmentKeys: String {
    case isUiTesing = "IS_UI_TESTING"
    case isUiTestingFailCreateEntry = "IS_UI_TESTING_FAIL_CREATE_ENTRY"
}

public extension ProcessInfo {
    subscript(env: KowalskiEnvironmentKeys) -> String? {
        environment[env.rawValue]
    }
}
