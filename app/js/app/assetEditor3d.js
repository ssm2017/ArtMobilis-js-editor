angular.module('app')

.directive('assetEditor3d', ['DataManagerSvc', function(DataManagerSvc) {
  return {
    restrict: 'AE',
    scope: {
      asset_type: '@assetType',
      asset_id: '@assetId',
      enabled: '@'
    },
    templateUrl: 'templates/asset_editor_3d.html',
    link: function(scope, element, attr) {
      scope.mode = 'translate';
      scope.GetSelectionName = function() {
        if (scope.asset_id && _selection.index >= 0) {
          var channel = DataManagerSvc.GetData().channels[scope.asset_id];
          if (channel)
            return channel.contents[_selection.index].name;
        }
        return null;
      }

      var DEFAULT_CAMERA = new THREE.PerspectiveCamera(50, 1, 0.1, 10000);
      DEFAULT_CAMERA.name = 'Camera';
      DEFAULT_CAMERA.position.set(20, 10, 20);
      DEFAULT_CAMERA.lookAt(new THREE.Vector3());


      var _element = element[0];
      var _canvas = _element.children[0];

      var _camera = DEFAULT_CAMERA.clone();

      var _scene = new THREE.Scene();
      _scene.name = 'Scene';
      var _renderer = new THREE.WebGLRenderer( { alpha: true, canvas: _canvas, antialias: true } );
      _renderer.autoClear = false;

      var _scene_helpers = new THREE.Scene();

      var _helpers = {};

      var _running = false;


      var _grid = new THREE.GridHelper( 50, 1 );
      _grid.scale.x = _grid.scale.y = _grid.scale.z = 0.25;

      var _asset = {
        type: '',
        id: '',
        channel: null,
        content: null,
        object: null,
        marker: null,
        marker_object: CreateMarkerObject(),
        contents_object: new THREE.Object3D(),
        container_object: new THREE.Object3D()
      };

      var _selection = {
        object: null,
        box: new THREE.BoxHelper(),
        index: -1
      };
      _selection.box.material.depthTest = false;
      _selection.box.material.transparent = true;
      _selection.box.visible = false;
      _scene_helpers.add(_selection.box);

      var _transform_controls;
      var _controls;


      function CreateMarkerObject() {
        var material = new THREE.MeshBasicMaterial( { side: THREE.DoubleSide } );
        var geometry = new THREE.PlaneGeometry(1, 1);
        var mesh = new THREE.Mesh(geometry, material);
        mesh.position.z = -0.001;
        return mesh;
      }

      var AddHelper = function() {

        var geometry = new THREE.SphereBufferGeometry(2, 4, 2);
        var material = new THREE.MeshBasicMaterial( { color: 0xff0000, visible: false } );

        return function (object) {

          var helper;

          if (object instanceof THREE.Camera) {
            helper = new THREE.CameraHelper(object, 1);
          } else if (object instanceof THREE.PointLight) {
            helper = new THREE.PointLightHelper(object, 1);
          } else if (object instanceof THREE.DirectionalLight) {
            helper = new THREE.DirectionalLightHelper(object, 1);
          } else if (object instanceof THREE.SpotLight) {
            helper = new THREE.SpotLightHelper(object, 1);
          } else if (object instanceof THREE.HemisphereLight) {
            helper = new THREE.HemisphereLightHelper(object, 1);
          } else if (object instanceof THREE.SkinnedMesh) {
            helper = new THREE.SkeletonHelper(object);
          } else {
            // no helper for this object type
            return;

          }

          var picker = new THREE.Mesh(geometry, material);
          picker.name = 'picker';
          picker.userData.object = object;
          helper.add(picker);

          _scene_helpers.add(helper);
          _helpers[object.id] = helper;

        };
      }();

      function RemoveHelper(object) {
        if (_helpers[object.id] !== undefined) {

          var helper = _helpers[object.id];
          helper.parent.remove(helper);

          delete _helpers[object.id];

        }
      }

      function AddObject(object) {
        object.traverse(function(child) {
          AddHelper(child);
        });

        _scene.add(object);
      }

      function Select(object) {
        while (object) {
          if (typeof object.userData.index === 'number')
            break;
          object = object.parent;
        }

        if ( _selection.object === object ) return;

        ResetSelection();

        if (object) {
          _selection.object = object;
          _selection.index = _selection.object.userData.index;
          if (object.geometry !== undefined &&
             object instanceof THREE.Sprite === false) {

            _selection.box.update(object);
            _selection.box.visible = true;
          }

          _transform_controls.attach(object);
        }
        scope.$apply();
      }

      function ResetSelection() {
        if (_transform_controls)
          _transform_controls.detach();
        _selection.object = null;
        _selection.box.visible = false;
        _selection.index = -1;
      }

      // object picking

      var raycaster = new THREE.Raycaster();
      var mouse = new THREE.Vector2();

      function GetIntersect(point, object) {
        mouse.set((point.x * 2) - 1, -(point.y * 2) + 1);
        raycaster.setFromCamera(mouse, _camera);
        var intersects = raycaster.intersectObjects(object.children, true);
        if (intersects.length > 0) {
          var inter = intersects[0];
          var output = inter.object;

          while(output.parent && output.parent !== object) {
            output = output.parent;
          }

          return output;
        }
      }

      var _on_down_position = new THREE.Vector2();
      var _on_up_position = new THREE.Vector2();
      var _on_double_click_position = new THREE.Vector2();

      function GetMousePosition(dom, x, y) {
        var rect = dom.getBoundingClientRect();
        return [(x - rect.left) / rect.width, (y - rect.top) / rect.height];
      }

      function OnTransformControlsMouseDown() {
        _controls.enabled = false;
      }

      function OnTransformControlsMouseUp() {
        _controls.enabled = true;
      }

      function HandleClick() {
        if (_on_down_position.distanceTo(_on_up_position) === 0) {
          var object = GetIntersect(_on_up_position, _asset.contents_object);
          if (object && object.userData.object !== undefined)
            Select(object.userData.object); // helper
          else
            Select(object);

          Render();
        }
      }

      function OnMouseDown(event) {
        event.preventDefault();

        var array = GetMousePosition(_element, event.clientX, event.clientY);
        _on_down_position.fromArray(array);
        document.addEventListener('mouseup', OnMouseUp, false);
      }

      function OnMouseUp(event) {
        var array = GetMousePosition(_element, event.clientX, event.clientY);
        _on_up_position.fromArray(array);

        HandleClick();

        document.removeEventListener('mouseup', OnMouseUp, false);
      }

      function OnTouchStart(event) {
        var touch = event.changedTouches[0];

        var array = GetMousePosition(_element, touch.clientX, touch.clientY);
        _on_down_position.fromArray(array);

        document.addEventListener('touchend', OnTouchEnd, false);
      }

      function OnTouchEnd(event) {
        var touch = event.changedTouches[0];

        var array = GetMousePosition(_element, touch.clientX, touch.clientY);
        _on_up_position.fromArray(array);

        HandleClick();

        document.removeEventListener('touchend', OnTouchEnd, false);
      }

      function OnDoubleClick(event) {
        var array = GetMousePosition(_element, event.clientX, event.clientY);
        _on_double_click_position.fromArray(array);

        var object = GetIntersect(_on_double_click_position, _asset.contents_object);

        if (object) {
          OnObjectFocused(object);
        }
      }

      function OnObjectFocused(object) {
        _controls.focus(object);
      }

      function OnControlsChange() {
        _transform_controls.update();
      }

      function Point3DCopy(src, dst) {
        dst.x = src.x;
        dst.y = src.y;
        dst.z = src.z;
      }

      function SaveChanges(object) {
        if (object && typeof object.userData.index === 'number') {
          var index = object.userData.index;
          if (_asset.channel) {
            var content = _asset.channel.contents[index];
            Point3DCopy(object.position, content.position);
            Point3DCopy(object.rotation, content.rotation);
            Point3DCopy(object.scale, content.scale);
          }
        }
      }

      function OnTransformChange() {
        var object = _transform_controls.object;
        if (object !== undefined) {

          _selection.box.update(object);

          SaveChanges(object);
        }
      }

      function OnAssetChange() {
        ClearScene();

        switch(_asset.type) {
          case 'channels':
            DataManagerSvc.GetLoadPromise().then(function() {
              _asset.channel = DataManagerSvc.GetData().channels[_asset.id];
              if (!_asset.channel)
                return;

              SetChannel();
            });
          break;

          case 'contents':
            DataManagerSvc.GetLoadPromise().then(function() {
              _asset.content = DataManagerSvc.GetData().contents[_asset.id];
              if (_asset.content) {
                var object = DataManagerSvc.GetData().objects[_asset.content.object];
                if (object) {
                  _asset.container_object.add(object.clone());
                  AMTHREE.PlayAnimatedTextures(_scene);
                  AMTHREE.PlaySounds(_scene);
                }
              }
            });
          break;

          case 'objects':
            DataManagerSvc.GetLoadPromise().then(function() {
              _asset.object = DataManagerSvc.GetData().objects[_asset.id];
              if (_asset.object) {
                _asset.container_object.add(_asset.object.clone());
                AMTHREE.PlayAnimatedTextures(_scene);
                AMTHREE.PlaySounds(_scene);
              }
            });
          break;

          case 'markers':
            DataManagerSvc.GetLoadPromise().then(function() {
              _asset.marker = DataManagerSvc.GetData().markers[_asset.id];
              if (_asset.marker) {
                SetMarker(_asset.marker);
              }
            });
          break;
        }
      }

      function ClearScene() {
        AMTHREE.StopAnimatedTextures(_scene);
        AMTHREE.StopSounds(_scene);
        ResetSelection();
        _asset.marker_object.visible = false;
        _asset.contents_object.remove.apply(_asset.contents_object, _asset.contents_object.children);
        _asset.container_object.remove.apply(_asset.container_object, _asset.container_object.children);
        _asset.channel = null;
        _asset.content = null;
        _asset.object  = null;
        _asset.marker  = null;
      }

      function SetMarker(marker) {
        if (marker) {
          (new THREE.TextureLoader()).load(marker.url, function(texture) {
            _asset.marker_object.material.map = texture;
            _asset.marker_object.material.needsUpdate = true;
            _asset.marker_object.visible = true;
          });
        }
      }

      function SetChannel() {
        LoadContents();

        var marker = DataManagerSvc.GetData().markers[_asset.channel.marker];
        SetMarker(marker);
        AMTHREE.PlayAnimatedTextures(_scene);
        AMTHREE.PlaySounds(_scene);
      }

      function Update() {
        AMTHREE.UpdateAnimatedTextures(_scene);
      }

      function Render() {
        _scene_helpers.updateMatrixWorld();
        _scene.updateMatrixWorld();

        _renderer.clear();
        _renderer.render(_scene, _camera);
        _renderer.render(_scene_helpers, _camera);
      }

      function OnWindowResize() {
        _renderer.setSize(_element.clientWidth, _element.clientHeight);
        _camera.aspect = _renderer.domElement.width / _renderer.domElement.height;
        _camera.updateProjectionMatrix();
      }

      function CheckCanvasSize() {
        if (_element.clientWidth != _canvas.width || _element.clientHeight != _canvas.height) {
          OnWindowResize();
        }
      }

      function GetBoundingSphere(object, sphere) {
        var box = new THREE.Box3();

        box.setFromObject(object);
        box.getBoundingSphere(sphere);
      }

      function LoadContents() {
        _asset.contents_object.remove.apply(_asset.contents_object, _asset.contents_object.children);

        var sphere = new THREE.Sphere();

        for(var len = _asset.channel.contents.length, index = 0; index < len; ++index) {
          var contents_transform = _asset.channel.contents[index];
          var contents_uuid = contents_transform.uuid;
          var contents = DataManagerSvc.GetData().contents[contents_uuid];
          if (!contents)
            continue;
          var object = DataManagerSvc.GetData().objects[contents.object];
          if (!object)
            continue;

          object = object.clone();

          object.userData = object.userData || {};
          object.userData.index = index;


          var pos = contents_transform.position;
          var rot = contents_transform.rotation;
          var scale = contents_transform.scale;

          object.position.set(pos.x, pos.y, pos.z);
          object.rotation.set(rot.x, rot.y, rot.z);
          object.scale.set(scale.x, scale.y, scale.z);

          GetBoundingSphere(object, sphere);

          _asset.contents_object.add(object);
        }
      }


      _scene.add(new THREE.HemisphereLight(0xffffbb, 0x080820, 1));
      _scene.add(new THREE.AmbientLight(0x404040));

      _scene.add(_asset.contents_object);
      _scene.add(_asset.marker_object);
      _scene.add(_asset.container_object);

      _scene.add(_grid);


      scope.$watchGroup(['asset_type', 'asset_id'], function(new_values) {
        _asset.type = new_values[0];
        _asset.id   = new_values[1];
        OnAssetChange();
      });

      scope.$watch('mode', function(mode) {
        _transform_controls.setMode(mode);
      });

      scope.$watch('enabled', function(enabled) {
        if (enabled === 'true') {
          Run();
        }
        else if (enabled === 'false') {
          Stop();
        }
      });


      function Stop() {
        if (_running) {
          _scene_helpers.remove(_transform_controls);

          window.removeEventListener('resize', OnWindowResize, false);

          _canvas.removeEventListener('mousedown', OnMouseDown, false);
          _canvas.removeEventListener('touchstart', OnTouchStart, false);
          _canvas.removeEventListener('dblclick', OnDoubleClick, false);

          _transform_controls.removeEventListener('change', OnTransformChange, false);
          _transform_controls.removeEventListener('mouseDown', OnTransformControlsMouseDown);
          _transform_controls.removeEventListener('mouseUp', OnTransformControlsMouseUp);

          _controls.removeEventListener('change', OnControlsChange, false);

          _controls.dispose();
          _transform_controls.dispose();
          _controls = undefined;
          _transform_controls = undefined;

          _renderer.clear();

          _running = false;
        }
      }

      function Run() {
        if (!_running) {
          _running = true;

          window.addEventListener('resize', OnWindowResize, false);
          OnWindowResize();

          _canvas.addEventListener('mousedown', OnMouseDown, false);
          _canvas.addEventListener('touchstart', OnTouchStart, false);
          _canvas.addEventListener('dblclick', OnDoubleClick, false);

          _transform_controls = new AMTHREE.TransformControls(_camera, _element);
          _controls = new THREE.EditorControls(_camera, _element);

          _transform_controls.addEventListener('change', OnTransformChange, false);
          _transform_controls.addEventListener('mouseDown', OnTransformControlsMouseDown);
          _transform_controls.addEventListener('mouseUp', OnTransformControlsMouseUp);

          _controls.addEventListener('change', OnControlsChange, false);

          _scene_helpers.add(_transform_controls);

          function Loop() {
            if (_running) {
              window.requestAnimationFrame(Loop);
              CheckCanvasSize();
              Update();
              Render();
            }
          };
          Loop();
        }
      }

      Run();

      scope.$on('$destroy', function() {
        Stop();
      })

    }

  }
}])