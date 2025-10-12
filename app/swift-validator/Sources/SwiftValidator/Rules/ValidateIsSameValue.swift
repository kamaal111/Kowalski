//
//  ValidateIsSameValue.swift
//  swift-validator
//
//  Created by Kamaal M Farah on 06/07/2024.
//

public class ValidateIsSameValue<Value: Equatable>: ValidatableRule {
    public static func == (lhs: ValidateIsSameValue<Value>, rhs: ValidateIsSameValue<Value>) -> Bool {
        lhs.value == rhs.value && lhs.message == rhs.message
    }

    public let code = "same_value"
    public let value: Value
    public let message: String?

    public init(value: Value, message: String?) {
        self.value = value
        self.message = message
    }

    public func validate(_ value: Value) -> Bool {
        self.value == value
    }
}
