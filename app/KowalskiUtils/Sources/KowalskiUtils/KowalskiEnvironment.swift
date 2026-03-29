//
//  KowalskiEnvironment.swift
//  KowalskiUtils
//
//  Created by Kamaal M Farah on 3/28/26.
//

import Foundation

public enum KowalskiEnvironment {
    public static let isUiTesting = ProcessInfo.processInfo[.isUiTesing] == "1"
    public static let isUiTestingListEntries = ProcessInfo.processInfo[.isUiTestingListEntries] == "1"
    public static let isUiTestingFailCreateEntry = ProcessInfo.processInfo[.isUiTestingFailCreateEntry] == "1"
    public static let isUiTestingValidationFailCreateEntry =
        ProcessInfo.processInfo[.isUiTestingValidationFailCreateEntry] == "1"
    public static let isUiTestingFailListEntries = ProcessInfo.processInfo[.isUiTestingFailListEntries] == "1"
}

public enum KowalskiEnvironmentKeys: String {
    case isUiTesing = "IS_UI_TESTING"
    case isUiTestingListEntries = "IS_UI_TESTING_LIST_ENTRIES"
    case isUiTestingFailCreateEntry = "IS_UI_TESTING_FAIL_CREATE_ENTRY"
    case isUiTestingValidationFailCreateEntry = "IS_UI_TESTING_VALIDATION_FAIL_CREATE_ENTRY"
    case isUiTestingFailListEntries = "IS_UI_TESTING_FAIL_LIST_ENTRIES"
}

public extension ProcessInfo {
    subscript(env: KowalskiEnvironmentKeys) -> String? {
        environment[env.rawValue]
    }
}
