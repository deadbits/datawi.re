var datawire = angular.module('datawire', ['ngRoute', 'ngAnimate', 'angular-loading-bar', 'ui.bootstrap',
                                           'debounce', 'truncate', 'infinite-scroll', 'datawire.templates']);

datawire.config(['$routeProvider', '$locationProvider', 'cfpLoadingBarProvider',
    function($routeProvider, $locationProvider, cfpLoadingBarProvider) {

  cfpLoadingBarProvider.includeSpinner = false;

  $routeProvider.when('/', {
    templateUrl: 'templates/index.html',
    controller: 'IndexCtrl'
  });

  $routeProvider.when('/lists/new', {
    templateUrl: 'lists/new.html',
    controller: 'ListsNewCtrl',
    loginRequired: true
  });

  $routeProvider.when('/lists/:id', {
    templateUrl: 'lists/edit.html',
    controller: 'ListsEditCtrl',
    loginRequired: true
  });

  $routeProvider.when('/lists/:id/entities', {
    templateUrl: 'lists/entities.html',
    controller: 'ListsEntitiesCtrl',
    reloadOnSearch: false,
    loginRequired: true
  });

  $routeProvider.otherwise({
    redirectTo: '/',
    loginRequired: false
  });

  $locationProvider.html5Mode(true);
}]);


datawire.directive('entityIcon', ['$http', function($http) {
  return {
    restrict: 'E',
    transclude: true,
    scope: {
      'category': '='
    },
    templateUrl: 'entities/icon.html',
    link: function (scope, element, attrs, model) {
    }
  };
}]);
;
datawire.controller('AppCtrl', ['$scope', '$rootScope', '$location', '$route', '$http', '$modal', '$q',
                             'Flash', 'Session',
  function($scope, $rootScope, $location, $route, $http, $modal, $q, Flash, Session) {
  $scope.session = {logged_in: false};
  $scope.flash = Flash;

  Session.get(function(session) {
    $scope.session = session;
  });

  $rootScope.$on("$routeChangeStart", function (event, next, current) {
    Session.get(function(session) {
      if (next.$$route && next.$$route.loginRequired && !session.logged_in) {
        $location.search({});
        $location.path('/');
      }
    });
  });

  $scope.editProfile = function() {
    var d = $modal.open({
        templateUrl: 'profile.html',
        controller: 'ProfileCtrl',
        backdrop: true
    });
  };

}]);


datawire.controller('IndexCtrl', ['$scope', function($scope) {

}]);



datawire.controller('ProfileCtrl', ['$scope', '$location', '$modalInstance', '$http', 'Session',
  function($scope, $location, $modalInstance, $http, Session) {
  $scope.user = {};
  $scope.session = {};

  Session.get(function(session) {
    $scope.user = session.user;
    $scope.session = session;
  });

  $scope.cancel = function() {
    $modalInstance.dismiss('cancel');
  };

  $scope.update = function(form) {
    var res = $http.post('/api/1/users/' + $scope.user.id, $scope.user);
    res.success(function(data) {
      $scope.user = data;
      $scope.session.user = data;
      $modalInstance.dismiss('ok');
    });
  };  
}]);
;datawire.directive('alephPager', ['$timeout', function ($timeout) {
    return {
        restrict: 'E',
        scope: {
            'response': '=',
            'load': '&load'
        },
        templateUrl: 'pager.html',
        link: function (scope, element, attrs, model) {
            scope.$watch('response', function(e) {
                scope.showPager = false;
                scope.pages = [];
                if (scope.response.pages <= 1) {
                    return;
                }
                var pages = [],
                    current = (scope.response.offset / scope.response.limit) + 1,
                    num = Math.ceil(scope.response.total / scope.response.limit),
                    range = 2,
                    low = current - range,
                    high = current + range;

                if (low < 1) {
                    low = 1;
                    high = Math.min((2*range)+1, num);
                }
                if (high > num) {
                    high = num;
                    low = Math.max(1, num - (2*range)+1);
                }

                for (var page = low; page <= high; page++) {
                    var offset = (page-1) * scope.response.limit,
                        url = scope.response.format.replace('LIMIT', scope.response.limit).replace('OFFSET', offset);
                    pages.push({
                        page: page,
                        current: page==current,
                        url: url
                    });
                }
                scope.showPager = true;
                scope.pages = pages;
            });
        }
    };
}]);
;
datawire.controller('ListsEntitiesCtrl', ['$scope', '$location', '$http', '$routeParams', 'Validation', 'Flash',
  function($scope, $location, $http, $routeParams, Validation, Flash) {
  
  var apiUrl = '/api/1/lists/' + $routeParams.id;
  $scope.query = $location.search();
  $scope.list = {};
  $scope.entities = {};
  $scope.edit = null;
  $scope.newEntity = {'category': 'Person'};

  $http.get(apiUrl).then(function(res) {
    $scope.list = res.data;
  });

  $scope.setEdit = function(val, suggestCreate) {
    $scope.edit = val;
    if (suggestCreate) {
      $scope.newEntity = {
        'category': 'Person',
        'label': $scope.query.prefix
      };
    } else if (val) {
      setTimeout(function() {
        $('#edit-label-' + val).focus();  
      }, 20);
    }
  };

  var handleResult = function(res) {
    $('#prefix-search').focus();
    angular.forEach(res.data.results, function(e) {
      var aliases = [];
      angular.forEach(e.selectors, function(s) {
        if (s !== e.label) {
          aliases.push(s);
        }
      });
      e.aliases = aliases.join(', ');
    });
    $scope.entities = res.data;
    if ($scope.entities.total == 0) {
      $scope.setEdit('new', true);
    }
  };

  var adaptEntity = function(entity) {
    entity.selectors = [];
    entity.list = $routeParams.id;
    entity.aliases = entity.aliases || '';
    angular.forEach(entity.aliases.split(','), function(s) {
      s = s.trim();
      if (s.length) entity.selectors.push(s);
    });
    return entity;
  };

  $scope.create = function(form) {
    var entity = adaptEntity($scope.newEntity);
    var res = $http.post('/api/1/entities', entity);
    res.success(function(data) {
      Flash.message("We track 'em, you whack 'em.", 'success');
      $scope.setEdit(null);
      $scope.entities.results.unshift(data);
      $scope.newEntity = {'category': 'Person'};
    });
    res.error(Validation.handle(form));
  };

  $scope.update = function(form, entity) {
    entity = adaptEntity(entity);
    var res = $http.post(entity.api_url, entity);
    res.success(function(data) {
      Flash.message("Your changes have been saved.", 'success');
      $scope.setEdit(null);
    });
    res.error(Validation.handle(form));
  };

  $scope.loadQuery = function() {
    $scope.setEdit(null);
    $scope.query['list'] = $routeParams.id;
    $http.get('/api/1/entities', {params: $scope.query}).then(handleResult);
  };

  $scope.loadUrl = function(url) {
    $http.get(url).then(handleResult);
  }

  $scope.filter = function() {
    delete $scope.query['list'];
    $location.search($scope.query);
  };

  $scope.delete = function(entity) {
    $http.delete(entity.api_url).then(function(res) {
      var idx = $scope.entities.results.indexOf(entity);
      $scope.entities.results.splice(idx, 1);
    });
  };

  $scope.$on('$routeUpdate', function(){
    $scope.loadQuery();
  });

  $scope.loadQuery();

}]);
;
datawire.directive('listsFrame', ['$http', function($http) {
  return {
    restrict: 'E',
    transclude: true,
    scope: {
      'list': '=',
      'selected': '@'
    },
    templateUrl: 'lists/frame.html',
    link: function (scope, element, attrs, model) {
      $http.get('/api/1/lists').then(function(res) {
        scope.lists = res.data;
      })
    }
  };
}]);


datawire.controller('ListsEditCtrl', ['$scope', '$location', '$http', '$routeParams', '$modal',
                                   'Flash', 'Validation', 'QueryContext',
  function($scope, $location, $http, $routeParams, $modal, Flash, Validation, QueryContext) {
  
  var apiUrl = '/api/1/lists/' + $routeParams.id;
  $scope.list = {};
  $scope.users = {};

  $http.get(apiUrl).then(function(res) {
    $scope.list = res.data;
  })

  $http.get('/api/1/users').then(function(res) {
    $scope.users = res.data;
  })
  
  $scope.canSave = function() {
    return $scope.list.can_write;
  };

  $scope.hasUser = function(id) {
    var users = $scope.list.users || [];
    return users.indexOf(id) != -1;
  };

  $scope.toggleUser = function(id) {
    var idx = $scope.list.users.indexOf(id);
    if (idx != -1) {
      $scope.list.users.splice(idx, 1);
    } else {
      $scope.list.users.push(id);
    }
  };

  $scope.delete = function() {
    var d = $modal.open({
        templateUrl: 'lists_delete.html',
        controller: 'ListsDeleteCtrl',
        resolve: {
            list: function () { return $scope.list; }
        }
    });
  }

  $scope.save = function(form) {
    var res = $http.post(apiUrl, $scope.list);
    res.success(function(data) {
      QueryContext.reset();
      Flash.message('Your changes have been saved.', 'success');
    });
    res.error(Validation.handle(form));
  };

}]);


datawire.controller('ListsNewCtrl', ['$scope', '$location', '$http', '$routeParams',
                                  'Validation', 'QueryContext',
  function($scope, $location, $http, $routeParams, Validation, QueryContext) {
  $scope.list = {'public': false, 'new': true};
  
  $scope.canCreate = function() {
    return $scope.session.logged_in;
  };

  $scope.create = function(form) {
      var res = $http.post('/api/1/lists', $scope.list);
      res.success(function(data) {
        QueryContext.reset();
        $location.path('/lists/' + data.id + '/entities');
      });
      res.error(Validation.handle(form));
  };

}]);


datawire.controller('ListsDeleteCtrl', ['$scope', '$location', '$http', '$modalInstance', 'list',
                                        'Flash', 'QueryContext',
  function($scope, $location, $http, $modalInstance, list, Flash, QueryContext) {
  $scope.list = list;
  
  $scope.cancel = function() {
    $modalInstance.dismiss('cancel');
  };

  $scope.delete = function() {
    var res = $http.delete($scope.list.api_url);
    res.then(function(data) {
        QueryContext.reset();
        $location.path('/lists');
        $modalInstance.dismiss('ok');
    });
  };

}]);
;
datawire.factory('Session', ['$http', '$q', function($http, $q) {
    var dfd = null;

    var reset = function() {
        dfd = null;
    };

    var get = function(cb) {
        if (dfd === null) {
            var dt = new Date();
            var config = {cache: false, params: {'_': dt.getTime()}};
            dfd = $http.get('/api/1/sessions', config);
        }
        dfd.success(function(data) {
          data.cbq = data.logged_in ? data.user.id : 'anon';
          cb(data);
        });
    };

    return {
        get: get,
        reset: reset
    };
}]);


datawire.factory('Flash', ['$rootScope', '$timeout', function($rootScope, $timeout) {
  // Message flashing.
  var currentMessage = null;

  $rootScope.$on("$routeChangeSuccess", function() {
    currentMessage = null;
  });

  return {
    message: function(message, type) {
      currentMessage = [message, type];
      $timeout(function() {
        currentMessage = null;
      }, 2000);
    },
    getMessage: function() {
      return currentMessage;
    }
  };
}]);


datawire.factory('Validation', ['Flash', function(Flash) {
  // handle server-side form validation errors.
  return {
    handle: function(form) {
      return function(res) {
        if (res.status == 400 || !form) {
          var errors = [];
          
          for (var field in res.errors) {
            form[field].$setValidity('value', false);
            form[field].$message = res.errors[field];
            errors.push(field);
          }
          if (angular.isDefined(form._errors)) {
            angular.forEach(form._errors, function(field) {
              if (errors.indexOf(field) == -1 && form[field]) {
                form[field].$setValidity('value', true);
              }
            });
          }
          form._errors = errors;
        } else {
          Flash.message(res.message || res.title || 'Server error', 'danger');
        }
      }
    }
  };
}]);

;function forEachSorted(obj, iterator, context) {
    var keys = sortedKeys(obj);
    for (var i = 0; i < keys.length; i++) {
        iterator.call(context, obj[keys[i]], keys[i]);
    }
    return keys;
}

function sortedKeys(obj) {
    var keys = [];
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            keys.push(key);
        }
    }
    return keys.sort();
}

function queryString(params) {
    var parts = [];
    forEachSorted(params, function(value, key) {
      if (value === null || angular.isUndefined(value)) return;
      if (!angular.isArray(value)) value = [value];

      angular.forEach(value, function(v) {
        if (angular.isObject(v)) {
          if (angular.isDate(v)) {
            v = v.toISOString();
          } else {
            v = angular.toJson(v);
          }
        }
        parts.push(encodeURIComponent(key) + '=' +
                   encodeURIComponent(v));
      });
    });
    return parts.join('&');
}
