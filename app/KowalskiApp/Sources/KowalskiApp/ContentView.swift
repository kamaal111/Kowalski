//
//  ContentView.swift
//  KowalskiApp
//
//  Created by Kamaal M Farah on 8/31/25.
//

import SwiftUI
import KowalskiClient

struct EmailSignup: Codable {
    let name: String
    let email: String
    let password: String
}

let client = KowalskiClient()

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
        try! await client.auth.signIn(email: "john@apple.com", password: "password20")
    }
}

#Preview {
    ContentView()
}
