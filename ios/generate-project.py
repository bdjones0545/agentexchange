#!/usr/bin/env python3
"""Generate the dependency-free native Xcode project deterministically."""
from pathlib import Path
import hashlib, json, plistlib
root=Path(__file__).resolve().parent
project=root/'AgentExchange.xcodeproj'; project.mkdir(exist_ok=True)
def uid(value): return hashlib.sha256(value.encode()).hexdigest()[:24].upper()
def q(value): return json.dumps(str(value))
objects=[]
def obj(name,body): objects.append(f'{uid(name)} = {{ {body} }};'); return uid(name)
sources=sorted((root/'AgentExchange').glob('*.swift'))
refs=[]; builds=[]
for source in sources:
 refs.append(obj(source.name,f'isa = PBXFileReference; lastKnownFileType = sourcecode.swift; path = {q(source.name)}; sourceTree = "<group>";'))
 builds.append(obj('build-'+source.name,f'isa = PBXBuildFile; fileRef = {uid(source.name)};'))
assets=obj('assets','isa = PBXFileReference; lastKnownFileType = folder.assetcatalog; path = Assets.xcassets; sourceTree = "<group>";')
privacy=obj('privacy','isa = PBXFileReference; lastKnownFileType = text.xml; path = PrivacyInfo.xcprivacy; sourceTree = "<group>";')
assetbuild=obj('assetbuild',f'isa = PBXBuildFile; fileRef = {assets};')
privacybuild=obj('privacybuild',f'isa = PBXBuildFile; fileRef = {privacy};')
product=obj('product','isa = PBXFileReference; explicitFileType = wrapper.application; path = AgentExchange.app; sourceTree = BUILT_PRODUCTS_DIR;')
sourcegroup=obj('sourcegroup',f'isa = PBXGroup; children = ({",".join(refs+[assets,privacy])}); path = AgentExchange; sourceTree = "<group>";')
productgroup=obj('productgroup',f'isa = PBXGroup; children = ({product}); name = Products; sourceTree = "<group>";')
main=obj('main',f'isa = PBXGroup; children = ({sourcegroup},{productgroup}); sourceTree = "<group>";')
phase=obj('sources',f'isa = PBXSourcesBuildPhase; buildActionMask = 2147483647; files = ({",".join(builds)}); runOnlyForDeploymentPostprocessing = 0;')
resources=obj('resources',f'isa = PBXResourcesBuildPhase; buildActionMask = 2147483647; files = ({assetbuild},{privacybuild}); runOnlyForDeploymentPostprocessing = 0;')
frameworks=obj('frameworks','isa = PBXFrameworksBuildPhase; buildActionMask = 2147483647; files = (); runOnlyForDeploymentPostprocessing = 0;')
common={'ASSETCATALOG_COMPILER_APPICON_NAME':'AppIcon','CODE_SIGN_STYLE':'Automatic','CURRENT_PROJECT_VERSION':'2','GENERATE_INFOPLIST_FILE':'YES','INFOPLIST_KEY_CFBundleDisplayName':'AgentExchange','INFOPLIST_KEY_ITSAppUsesNonExemptEncryption':'NO','INFOPLIST_KEY_UIApplicationSceneManifest_Generation':'YES','INFOPLIST_KEY_UILaunchScreen_Generation':'YES','INFOPLIST_KEY_UISupportedInterfaceOrientations_iPhone':'UIInterfaceOrientationPortrait','INFOPLIST_KEY_UISupportedInterfaceOrientations_iPad':'UIInterfaceOrientationPortrait UIInterfaceOrientationPortraitUpsideDown UIInterfaceOrientationLandscapeLeft UIInterfaceOrientationLandscapeRight','IPHONEOS_DEPLOYMENT_TARGET':'17.0','MARKETING_VERSION':'1.0','PRODUCT_BUNDLE_IDENTIFIER':'ai.agentsexchange.ios','PRODUCT_NAME':'$(TARGET_NAME)','SDKROOT':'iphoneos','SUPPORTED_PLATFORMS':'iphoneos iphonesimulator','SUPPORTS_MACCATALYST':'NO','SWIFT_VERSION':'5.0','TARGETED_DEVICE_FAMILY':'1,2','ENABLE_USER_SCRIPT_SANDBOXING':'YES'}
configs=[]; pconfigs=[]
for mode in ['Debug','Release']:
 vals=dict(common)
 vals['SWIFT_OPTIMIZATION_LEVEL']='-Onone' if mode=='Debug' else '-O'
 vals['DEBUG_INFORMATION_FORMAT']='dwarf' if mode=='Debug' else 'dwarf-with-dsym'
 configs.append(obj(mode,'isa = XCBuildConfiguration; name = '+mode+'; buildSettings = {'+' '.join(f'{k} = {q(v)};' for k,v in vals.items())+'};'))
 pconfigs.append(obj('project'+mode,f'isa = XCBuildConfiguration; name = {mode}; buildSettings = {{ CLANG_ENABLE_MODULES = YES; }};'))
cl=obj('configs',f'isa = XCConfigurationList; buildConfigurations = ({",".join(configs)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
pcl=obj('pconfigs',f'isa = XCConfigurationList; buildConfigurations = ({",".join(pconfigs)}); defaultConfigurationIsVisible = 0; defaultConfigurationName = Release;')
target=obj('target',f'isa = PBXNativeTarget; buildConfigurationList = {cl}; buildPhases = ({phase},{frameworks},{resources}); buildRules = (); dependencies = (); name = AgentExchange; productName = AgentExchange; productReference = {product}; productType = "com.apple.product-type.application";')
pid=obj('project',f'isa = PBXProject; attributes = {{ LastUpgradeCheck = 2660; }}; buildConfigurationList = {pcl}; compatibilityVersion = "Xcode 14.0"; developmentRegion = en; hasScannedForEncodings = 0; knownRegions = (en,Base); mainGroup = {main}; productRefGroup = {productgroup}; projectDirPath = ""; projectRoot = ""; targets = ({target});')
(project/'project.pbxproj').write_text('// !$*UTF8*$!\n{ archiveVersion = 1; classes = {}; objectVersion = 56; objects = {\n'+'\n'.join(objects)+f'\n}}; rootObject = {pid}; }}\n')
scheme=project/'xcshareddata/xcschemes'; scheme.mkdir(parents=True,exist_ok=True)
ref=f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="AgentExchange.app" BlueprintName="AgentExchange" ReferencedContainer="container:AgentExchange.xcodeproj"/>'
(scheme/'AgentExchange.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2660" version="1.3"><BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES"><BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{ref}</BuildActionEntry></BuildActionEntries></BuildAction><LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></LaunchAction><ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{ref}</BuildableProductRunnable></ProfileAction><AnalyzeAction buildConfiguration="Debug"/><ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/></Scheme>''')
(root/'AgentExchange/PrivacyInfo.xcprivacy').write_bytes(plistlib.dumps({'NSPrivacyTracking':False,'NSPrivacyTrackingDomains':[],'NSPrivacyCollectedDataTypes':[{'NSPrivacyCollectedDataType':'NSPrivacyCollectedDataTypeEmailAddress','NSPrivacyCollectedDataTypeLinked':True,'NSPrivacyCollectedDataTypeTracking':False,'NSPrivacyCollectedDataTypePurposes':['NSPrivacyCollectedDataTypePurposeAppFunctionality']},{'NSPrivacyCollectedDataType':'NSPrivacyCollectedDataTypeUserID','NSPrivacyCollectedDataTypeLinked':True,'NSPrivacyCollectedDataTypeTracking':False,'NSPrivacyCollectedDataTypePurposes':['NSPrivacyCollectedDataTypePurposeAppFunctionality']}],'NSPrivacyAccessedAPITypes':[{'NSPrivacyAccessedAPIType':'NSPrivacyAccessedAPICategoryUserDefaults','NSPrivacyAccessedAPITypeReasons':['CA92.1']}]}))
(root/'AgentExchange/Assets.xcassets/Contents.json').write_text(json.dumps({'info':{'author':'xcode','version':1}}))
(root/'AgentExchange/Assets.xcassets/AppIcon.appiconset/Contents.json').write_text(json.dumps({'images':[{'filename':'AppIcon.png','idiom':'universal','platform':'ios','size':'1024x1024'}],'info':{'author':'xcode','version':1}}))
print(project)
