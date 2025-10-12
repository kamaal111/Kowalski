//
//  StringValidator.swift
//  swift-validator
//
//  Created by Kamaal M Farah on 16/06/2024.
//

public struct StringValidator: ValueValidatable {
    public static func == (lhs: StringValidator, rhs: StringValidator) -> Bool {
        lhs.result == rhs.result
    }

    public var result: (valid: Bool, message: String?)

    public init(value: String, validators: [any StringValidatableRule]) {
        assert(
            Dictionary(grouping: validators, by: \.code).values.flatMap({ $0 }).count == validators.count,
            "Codes should be unique"
        )
        let invalidity = validators.first(where: { validator in !validator.validate(value) })
        self.result = (invalidity == nil, invalidity?.message)
    }
}
