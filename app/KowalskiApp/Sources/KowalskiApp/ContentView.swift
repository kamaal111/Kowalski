//
//  ContentView.swift
//  KowalskiApp
//
//  Created by Kamaal M Farah on 8/31/25.
//

import SwiftUI
import KowalskiUtils
import KowalskiClient

let client = KowalskiClient()

struct Credentials: Codable {
    let email: String
    let password: String
    let authToken: String
    let expiry: Int
}

struct ContentView: View {
    var body: some View {
        VStack {
            Button(action: { Task { await handlePress() }}) {
                Text("Press Me")
            }
        }
        .padding()
    }

    private func handlePress() async {
        let key = "\(Bundle.main.bundleIdentifier!).credentials"
        if let credentials = try! Keychain.get(forKey: key).get() {
            print(String(data: credentials, encoding: .utf8)!)
        } else {
            let email = "john@apple.com"
            let password = "password20"
            let response = try! await client.auth.signIn(email: email, password: password).get()
            let jsonEncoder = JSONEncoder()
            let credentials = Credentials(
                email: email,
                password: password,
                authToken: response.authToken,
                expiry: response.expiry
            )
            let data = try! jsonEncoder.encode(credentials)
            let result = Keychain.set(data, forKey: key)
            print(result)
        }
    }
}

#Preview {
    ContentView()
}
