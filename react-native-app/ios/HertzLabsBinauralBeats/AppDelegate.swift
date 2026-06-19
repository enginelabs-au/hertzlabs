import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import RNBranch
@main
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    var reactNativeDelegate: ReactNativeDelegate?
    var reactNativeFactory: RCTReactNativeFactory?

    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        // Branch.io — must be called before React Native init
        RNBranch.initSession(launchOptions: launchOptions, isReferrable: true)

        AudioSessionController.shared.configureForPlayback()

#if DEBUG
        #if targetEnvironment(simulator)
        ReactNativeDelegate.configureDebugBundleProvider()
        #else
        // Physical device: wipe any cached Metro IP so RCTBundleURLProvider
        // doesn't override the embedded-bundle URL we return in bundleURL().
        RCTBundleURLProvider.sharedSettings().jsLocation = nil
        #endif
#endif

        let delegate = ReactNativeDelegate()
        let factory = RCTReactNativeFactory(delegate: delegate)
        delegate.dependencyProvider = RCTAppDependencyProvider()

        reactNativeDelegate = delegate
        reactNativeFactory = factory

        window = UIWindow(frame: UIScreen.main.bounds)

        factory.startReactNative(
            withModuleName: "HertzLabsBinauralBeats",
            in: window,
            launchOptions: launchOptions
        )

        return true
    }
}

    // Branch deep link handlers
    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        return RNBranch.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        return RNBranch.continue(userActivity)
    }

    func application(_ application: UIApplication, didReceiveRemoteNotification userInfo: [AnyHashable: Any]) {
        RNBranch.application(application, didReceiveRemoteNotification: userInfo)
    }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
    override func sourceURL(for bridge: RCTBridge) -> URL? {
        self.bundleURL()
    }

    override func bundleURL() -> URL? {
#if DEBUG
#if targetEnvironment(simulator)
        // Simulator: Metro for fast refresh.
        let host = ReactNativeDelegate.debugHost()
        return URL(string: "http://\(host):8081/index.bundle?platform=ios&dev=true&minify=false&lazy=true")
#else
        // Physical device: use the JS bundle Xcode embedded at build time so the
        // app runs without Metro (avoids "Could not connect to development server").
        if let embedded = Bundle.main.url(forResource: "main", withExtension: "jsbundle") {
            return embedded
        }
        let host = ReactNativeDelegate.debugHost()
        return URL(string: "http://\(host):8081/index.bundle?platform=ios&dev=true&minify=false&lazy=true")
#endif
#else
        Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
    }

#if DEBUG
    static func debugHost() -> String {
#if targetEnvironment(simulator)
        return "localhost"
#else
        if let ipPath = Bundle.main.path(forResource: "ip", ofType: "txt"),
           let ip = try? String(contentsOfFile: ipPath, encoding: .utf8) {
            let host = ip.trimmingCharacters(in: .whitespacesAndNewlines)
            // Reject loopback/link-local values — they break physical-device Metro.
            if !host.isEmpty,
               !host.hasPrefix("127."),
               !host.hasPrefix("169.254.") {
                return host
            }
        }
        return RCTBundleURLProvider.sharedSettings().jsLocation ?? "localhost"
#endif
    }

    static func configureDebugBundleProvider() {
        RCTBundleURLProvider.sharedSettings().jsLocation = debugHost()
    }
#endif
}
