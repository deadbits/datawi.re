
var datawire = angular.module('datawire', [], function($routeProvider, $locationProvider) {
  $routeProvider.when('/profile', {
    templateUrl: '/static/partials/profile.html',
    controller: ProfileCtrl,
    accessPolicy: 'user'
  });

  $routeProvider.when('/feed', {
    templateUrl: '/static/partials/feed.html',
    controller: FeedCtrl,
    accessPolicy: 'user'
  });

  $routeProvider.when('/about/:page', {
    templateUrl: '/static/partials/docs.html',
    controller: DocsCtrl
  });

  $routeProvider.when('/', {
    templateUrl: '/static/partials/home.html',
    controller: HomeCtrl
  });

  $routeProvider.otherwise({
    redirectTo: '/'
  });

  $locationProvider.html5Mode(true);
});

datawire.directive('external', function ($window) {
    return {
        restrict: 'A',
        link: function(scope, element, attrs) {
            element.bind('click', function() {
                $window.location.href = attrs.external;
            });
        }
    };
});

datawire.directive('entityref', function ($window) {
    return {
        restrict: 'A',
        templateUrl: '/static/partials/ref.html',
        transclude: true,
        scope: {},
        link: function(scope, element, attrs) {
          scope.entity = attrs.entityref;
          element.bind('click', function() {
            element.find('div').toggleClass('visible');
          });
        }
    };
});

Handlebars.registerHelper('entity', function(text) {
    text = Handlebars.Utils.escapeExpression(text);
    var result = '<span entityref="' + text + '">' + text + '</span>';
    return new Handlebars.SafeString(result);
});
