//
//  SignUpPayload.swift
//  KowalskiFeatures
//
//  Created by Kamaal M Farah on 10/26/25.
//

struct SignUpPayload {
    let name: String
    let email: String
    let password: String

    init(name: String, email: String, password: String) {
        assert(email.trimmingCharacters(in: .whitespacesAndNewlines).count == email.count)
        assert(!email.isEmpty)
        assert(!password.isEmpty)
        assert(!name.isEmpty)

        self.name = name
        self.email = email
        self.password = password
    }
}
