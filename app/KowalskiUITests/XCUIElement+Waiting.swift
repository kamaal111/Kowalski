//
//  XCUIElement+Waiting.swift
//  KowalskiUITests
//

import XCTest

extension XCUIElement {
    /// Waits for the element to exist using a predicate expectation instead of tight polling.
    /// This avoids priority inversions caused by `waitForExistence`, which spins the main thread
    /// at user-interactive QoS while waiting for work that runs at a lower QoS.
    func waitForExistenceUsingPredicate(timeout: TimeInterval = 3) -> Bool {
        let predicate = NSPredicate(format: "exists == true")
        let expectation = XCTNSPredicateExpectation(predicate: predicate, object: self)
        return XCTWaiter().wait(for: [expectation], timeout: timeout) == .completed
    }
}
