angular.module('app')

.directive('journeyEditorToolbar', [
  'DataManagerSvc',
  'dataJourneyFactory',
  'ImportSvc',
  'ExportSvc',
  'ProjectsManagerSvc',
  function(DataManagerSvc,
    dataJourneyFactory,
    ImportSvc,
    ExportSvc,
    ProjectsManagerSvc) {
  return {
    restrict: 'E',
    link: function($scope, $element, $attr) {

      var template = [
        {
          label: 'File',
          submenu: [
            {
              label: 'New...',
              click: New,
              accelerator: 'CmdOrCtrl+N'
            },
            {
              label: 'Open...',
              click: Open,
              accelerator: 'CmdOrCtrl+L'
            },
            {
              label: 'Save',
              click: Save,
              accelerator: 'CmdOrCtrl+S'
            },
            {
              label: 'Import markers...',
              click: ImportMarkers,
              accelerator: 'CmdOrCtrl+M'
            },
            {
              label: 'Import objects',
              submenu: [
                {
                  label: 'Image, video, sound...',
                  click: ImportFilesAsPlanes
                },
                {
                  label: 'Model 3D...',
                  click: ImportObjects3D
                }
              ]
            },
            {
              label: 'Close project',
              click: CloseProject
            }
          ]
        },
        {
          label: 'Edit',
          submenu: [
            {
              label: 'Undo',
              accelerator: 'CmdOrCtrl+Z',
              role: 'undo'
            },
            {
              label: 'Redo',
              accelerator: 'Shift+CmdOrCtrl+Z',
              role: 'redo'
            },
            {
              type: 'separator'
            },
            {
              label: 'Cut',
              accelerator: 'CmdOrCtrl+X',
              role: 'cut'
            },
            {
              label: 'Copy',
              accelerator: 'CmdOrCtrl+C',
              role: 'copy'
            },
            {
              label: 'Paste',
              accelerator: 'CmdOrCtrl+V',
              role: 'paste'
            },
            {
              label: 'Select All',
              accelerator: 'CmdOrCtrl+A',
              role: 'selectall'
            },
          ]
        },
        {
          label: 'View',
          submenu: [
            {
              label: 'Reload',
              accelerator: 'CmdOrCtrl+R',
              click: function(item, focusedWindow) {
                if (focusedWindow)
                  focusedWindow.reload();
              }
            },
            {
              label: 'Toggle Full Screen',
              accelerator: (function() {
                if (process.platform == 'darwin')
                  return 'Ctrl+Command+F';
                else
                  return 'F11';
              })(),
              click: function(item, focusedWindow) {
                if (focusedWindow)
                  focusedWindow.setFullScreen(!focusedWindow.isFullScreen());
              }
            },
            {
              label: 'Toggle Developer Tools',
              accelerator: (function() {
                if (process.platform == 'darwin')
                  return 'Alt+Command+I';
                else
                  return 'F12';
              })(),
              click: function(item, focusedWindow) {
                if (focusedWindow)
                  focusedWindow.toggleDevTools();
              }
            },
          ]
        },
        {
          label: 'Window',
          role: 'window',
          submenu: [
            {
              label: 'Minimize',
              accelerator: 'CmdOrCtrl+M',
              role: 'minimize'
            },
            {
              label: 'Close',
              accelerator: 'CmdOrCtrl+W',
              role: 'close'
            },
          ]
        },
        {
          label: 'Help',
          role: 'help',
          submenu: [
            {
              label: 'Learn More',
              click: function() { require('electron').shell.openExternal('http://electron.atom.io') }
            },
          ]
        }
      ]

      var _remote = require('remote');
      var _dialog = _remote.require('electron').dialog;
      var Menu = _remote.Menu;

      var _menu = new Menu();
      _menu = Menu.buildFromTemplate(template);
      Menu.setApplicationMenu(_menu);

      function Open() {
        ImportSvc.Open();
      }

      function ImportMarkers() {
        ImportSvc.ImportMarkers();
      }

      function ImportFilesAsPlanes() {
        ImportSvc.ImportFilesAsPlanes();
      }

      function ImportObjects3D() {
        ImportSvc.ImportObjects3D();
      }

      function New() {
        ExportSvc.New();
      }

      function Save() {
        ExportSvc.Save();
      }

      function CloseProject() {
        ProjectsManagerSvc.Close();
        DataManagerSvc.Clear();
      }

      function OnProjectChange() {
        var active = !ProjectsManagerSvc.IsEmpty();
        var file_menu_items = _menu.items[0].submenu.items;
        file_menu_items[2].enabled = active;
        file_menu_items[3].enabled = active;
        file_menu_items[4].enabled = active;
        file_menu_items[5].enabled = active;
      }

      ProjectsManagerSvc.AddListenerChange(OnProjectChange);
      OnProjectChange();

      $scope.$on('$destroy', function() {
        ProjectsManagerSvc.RemoveListenerChange(OnProjectChange);
      })
    }
  }
}])