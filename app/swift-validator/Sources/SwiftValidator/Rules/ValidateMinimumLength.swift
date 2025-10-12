//
//  ValidateMinimumLength.swift
//  swift-validator
//
//  Created by Kamaal M Farah on 16/06/2024.
//

import Foundation

public class ValidateMinimumLength<Value: Collection>: ValidatableRule {
    public static func == (lhs: ValidateMinimumLength<Value>, rhs: ValidateMinimumLength<Value>) -> Bool {
        lhs.length == rhs.length && lhs.message == rhs.message
    }

    public let code = "minimum_length"
    public let length: Int
    public let message: String?

    public init(length: Int, message: String?) {
        self.length = length
        self.message = message
    }

    public func validate(_ value: Value) -> Bool {
        value.count >= length
    }
}
