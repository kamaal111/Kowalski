//
//  StringIsEmail.swift
//  swift-validator
//
//  Created by Kamaal M Farah on 2/16/25.
//

import Foundation

public class StringIsEmail: ValidatableRule, StringValidatableRule {
    public let code = "email_string"
    public let message: String?

    public init(message: String?) {
        self.message = message
    }

    public func validate(_ value: String) -> Bool {
        let emailRegEx = "(?i)^(?!\\.)(?!.*\\.\\.)([A-Z0-9_'+\\-\\.]*[A-Z0-9_+\\-])@([A-Z0-9][A-Z0-9\\-]*\\.)+[A-Z]{2,}$"
        let emailPred = NSPredicate(format:"SELF MATCHES %@", emailRegEx)

        return emailPred.evaluate(with: value)
    }
}
